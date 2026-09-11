import { Response } from "express";

interface ConnectedClient {
  userId: string;
  orgId: string;
  res: Response;
  connectedAt: Date;
}

export class RealtimeService {
  private static clients: Map<string, ConnectedClient> = new Map();
  private static userIndex: Map<string, Set<string>> = new Map();
  private static orgIndex: Map<string, Set<string>> = new Map();
  private static heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Registers a client SSE connection
   */
  static addClient(clientId: string, userId: string, orgId: string, res: Response) {
    this.clients.set(clientId, {
      userId,
      orgId,
      res,
      connectedAt: new Date(),
    });

    // Add to user index
    if (!this.userIndex.has(userId)) {
      this.userIndex.set(userId, new Set());
    }
    this.userIndex.get(userId)!.add(clientId);

    // Add to organization index
    if (orgId) {
      if (!this.orgIndex.has(orgId)) {
        this.orgIndex.set(orgId, new Set());
      }
      this.orgIndex.get(orgId)!.add(clientId);
    }

    // Start heartbeat if not running
    this.ensureHeartbeat();

    console.log(`🔌 [Realtime SSE] Client connected: ${clientId} (User: ${userId}, Org: ${orgId}). Total active: ${this.clients.size}`);
  }

  /**
   * Removes a client SSE connection
   */
  static removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user index
    const userClients = this.userIndex.get(client.userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userIndex.delete(client.userId);
      }
    }

    // Remove from org index
    if (client.orgId) {
      const orgClients = this.orgIndex.get(client.orgId);
      if (orgClients) {
        orgClients.delete(clientId);
        if (orgClients.size === 0) {
          this.orgIndex.delete(client.orgId);
        }
      }
    }

    this.clients.delete(clientId);
    console.log(`🔌 [Realtime SSE] Client disconnected: ${clientId}. Remaining: ${this.clients.size}`);
  }

  /**
   * Sends an SSE event to a specific response stream
   */
  private static sendEvent(res: Response, event: string, data: any): boolean {
    try {
      if (res.writableEnded || res.destroyed) return false;
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`event: ${event}\ndata: ${payload}\n\n`);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Emits an event to all connected sessions for a specific user
   */
  static emitToUser(userId: string, event: string, data: any) {
    const clientIds = this.userIndex.get(userId);
    if (!clientIds || clientIds.size === 0) {
      console.log(`📡 [Realtime SSE] User ${userId} has no active connections to receive event "${event}"`);
      return;
    }

    console.log(`⚡ [Realtime SSE] Pushing "${event}" to ${clientIds.size} connection(s) of user ${userId}`);
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        const ok = this.sendEvent(client.res, event, data);
        if (!ok) {
          this.removeClient(clientId);
        }
      }
    }
  }

  /**
   * Emits an event to all connected sessions within an organization
   */
  static emitToOrganization(orgId: string, event: string, data: any) {
    const clientIds = this.orgIndex.get(orgId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }

    console.log(`⚡ [Realtime SSE] Broadcasting "${event}" to org ${orgId} (${clientIds.size} client(s))`);
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        const ok = this.sendEvent(client.res, event, data);
        if (!ok) {
          this.removeClient(clientId);
        }
      }
    }
  }

  /**
   * Broadcasts to all active connections
   */
  static broadcast(event: string, data: any) {
    for (const [clientId, client] of this.clients.entries()) {
      const ok = this.sendEvent(client.res, event, data);
      if (!ok) {
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Sends heartbeat pings every 25 seconds to keep HTTP connections alive across proxies
   */
  private static ensureHeartbeat() {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) {
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        return;
      }

      for (const [clientId, client] of this.clients.entries()) {
        try {
          if (client.res.writableEnded || client.res.destroyed) {
            this.removeClient(clientId);
            continue;
          }
          client.res.write(": ping\n\n");
        } catch {
          this.removeClient(clientId);
        }
      }
    }, 25000);
  }

  /**
   * Returns current connection stats
   */
  static getStats() {
    return {
      activeConnections: this.clients.size,
      connectedUsers: this.userIndex.size,
      connectedOrgs: this.orgIndex.size,
    };
  }
}
