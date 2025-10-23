/**
 * @file analytics.service.ts
 * @description Analytics service for data analysis and reporting
 * Handles business logic for analytics operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";

/**
 * Analytics data interface
 */
interface AnalyticsRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  agent_id: string;
  query: string;
  response: string;
  vector_score?: number;
  created_at: string;
}

/**
 * Date filter interface
 */
interface DateFilter {
  gte?: string;
  lte?: string;
}

/**
 * User analytics result
 */
interface UserAnalyticsResult {
  totalQueries: number;
  uniqueAgents: number;
  avgResponseLength: number;
  period: string;
  recentQueries: AnalyticsRecord[];
}

/**
 * Tenant analytics result
 */
interface TenantAnalyticsResult {
  tenantId: string;
  totalQueries: number;
  uniqueUsers: number;
  uniqueAgents: number;
  avgResponseLength: number;
  period: string;
  dailyStats: Record<string, number>;
  topAgents: Array<{ agentId: string; count: number }>;
  recentQueries: AnalyticsRecord[];
}

/**
 * Agent analytics result
 */
interface AgentAnalyticsResult {
  agentId: string;
  totalQueries: number;
  avgResponseLength: number;
  recentQueries: AnalyticsRecord[];
}

/**
 * System analytics result
 */
interface SystemAnalyticsResult {
  totalAnalytics: number;
  uniqueUsers: number;
  uniqueAgents: number;
  uniqueTenants: number;
}

/**
 * Analytics Service Class
 */
export class AnalyticsService {
  /**
   * Build date filter from parameters
   */
  private buildDateFilter(period?: string, startDate?: string, endDate?: string): DateFilter {
    if (startDate && endDate) {
      // Parse dates and ensure proper time boundaries
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Set start to beginning of day (00:00:00.000)
      start.setHours(0, 0, 0, 0);

      // Set end to end of day (23:59:59.999)
      end.setHours(23, 59, 59, 999);

      return {
        gte: start.toISOString(),
        lte: end.toISOString(),
      };
    } else {
      // Default period filter
      const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - days);

      return {
        gte: defaultStartDate.toISOString(),
      };
    }
  }

  /**
   * Calculate average response length
   */
  private calculateAvgResponseLength(analytics: AnalyticsRecord[]): number {
    if (!analytics || analytics.length === 0) {
      return 0;
    }

    const totalLength = analytics.reduce((sum, a) => sum + (a.response?.length || 0), 0);
    return Math.round(totalLength / analytics.length);
  }

  /**
   * Get daily usage statistics
   */
  private getDailyStats(analytics: AnalyticsRecord[]): Record<string, number> {
    if (!analytics) {
      return {};
    }

    return analytics.reduce(
      (acc, a) => {
        const date = new Date(a.created_at).toISOString().split("T")[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Get top agents by usage
   */
  private getTopAgents(
    analytics: AnalyticsRecord[],
    limit: number = 5
  ): Array<{ agentId: string; count: number }> {
    if (!analytics) {
      return [];
    }

    const agentUsage = analytics.reduce(
      (acc, a) => {
        acc[a.agent_id] = (acc[a.agent_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(agentUsage)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([agentId, count]) => ({ agentId, count }));
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(
    userId: string,
    tenantId: string,
    period: string = "30d"
  ): Promise<UserAnalyticsResult> {
    try {
      // Get analytics data for the user
      const { data: analytics, error } = await supabaseAdmin
        .from("analytics")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        logger.error("Get user analytics error", { error: error.message, userId });
        throw new Error(error.message);
      }

      // Process analytics data
      const totalQueries = analytics?.length || 0;
      const uniqueAgents = new Set(analytics?.map((a) => a.agent_id)).size;
      const avgResponseLength = this.calculateAvgResponseLength(analytics || []);

      return {
        totalQueries,
        uniqueAgents,
        avgResponseLength,
        period,
        recentQueries: analytics?.slice(0, 10) || [],
      };
    } catch (error) {
      logger.error("User analytics service error", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Get tenant analytics
   */
  async getTenantAnalytics(
    tenantId: string,
    period?: string,
    startDate?: string,
    endDate?: string
  ): Promise<TenantAnalyticsResult> {
    try {
      // Build date filter
      const dateFilter = this.buildDateFilter(period, startDate, endDate);

      // Get analytics data for the tenant
      let query = supabaseAdmin.from("analytics").select("*").eq("tenant_id", tenantId);

      // Apply date filters
      if (dateFilter.gte) {
        query = query.gte("created_at", dateFilter.gte);
      }
      if (dateFilter.lte) {
        query = query.lte("created_at", dateFilter.lte);
      }

      const { data: analytics, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        logger.error("Get tenant analytics error", { error: error.message, tenantId });
        throw new Error(error.message);
      }

      // Process analytics data
      const totalQueries = analytics?.length || 0;
      const uniqueUsers = new Set(analytics?.map((a) => a.user_id)).size;
      const uniqueAgents = new Set(analytics?.map((a) => a.agent_id)).size;
      const avgResponseLength = this.calculateAvgResponseLength(analytics || []);
      const dailyStats = this.getDailyStats(analytics || []);
      const topAgents = this.getTopAgents(analytics || []);

      logger.info("Tenant analytics retrieved", {
        tenantId,
        totalQueries,
        uniqueUsers,
        uniqueAgents,
        period: period || "custom",
      });

      return {
        tenantId,
        totalQueries,
        uniqueUsers,
        uniqueAgents,
        avgResponseLength,
        period: period || "custom",
        dailyStats,
        topAgents,
        recentQueries: analytics?.slice(0, 20) || [],
      };
    } catch (error) {
      logger.error("Tenant analytics service error", { error, tenantId });
      throw error;
    }
  }

  /**
   * Get agent analytics
   */
  async getAgentAnalytics(
    agentId: string,
    userId: string,
    tenantId: string
  ): Promise<AgentAnalyticsResult> {
    try {
      // Get analytics data for the specific agent
      const { data: analytics, error } = await supabaseAdmin
        .from("analytics")
        .select("*")
        .eq("agent_id", agentId)
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        logger.error("Get agent analytics error", { error: error.message, agentId, userId });
        throw new Error(error.message);
      }

      // Process analytics data
      const totalQueries = analytics?.length || 0;
      const avgResponseLength = this.calculateAvgResponseLength(analytics || []);

      return {
        agentId,
        totalQueries,
        avgResponseLength,
        recentQueries: analytics?.slice(0, 10) || [],
      };
    } catch (error) {
      logger.error("Agent analytics service error", { error, agentId, userId, tenantId });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    tenantId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      agentId?: string;
    }
  ): Promise<AnalyticsRecord[]> {
    try {
      // Build query
      let query = supabaseAdmin.from("analytics").select("*").eq("tenant_id", tenantId);

      // Add filters
      if (filters.agentId) {
        query = query.eq("agent_id", filters.agentId);
      }

      if (filters.startDate && filters.endDate) {
        // Parse dates and ensure proper time boundaries
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      const { data: analytics, error } = await query.order("created_at", { ascending: false });

      if (error) {
        logger.error("Export analytics error", { error: error.message, tenantId });
        throw new Error(error.message);
      }

      logger.info("Analytics exported", {
        tenantId,
        recordCount: analytics?.length || 0,
      });

      return analytics || [];
    } catch (error) {
      logger.error("Export analytics service error", { error, tenantId });
      throw error;
    }
  }

  /**
   * Get system analytics (Admin only)
   */
  async getSystemAnalytics(): Promise<SystemAnalyticsResult> {
    try {
      // Get total analytics count
      const { count: totalAnalytics } = await supabaseAdmin
        .from("analytics")
        .select("*", { count: "exact", head: true });

      // Get unique users count
      const { data: uniqueUsers } = await supabaseAdmin
        .from("analytics")
        .select("user_id")
        .not("user_id", "is", null);

      const uniqueUsersCount = new Set(uniqueUsers?.map((u) => u.user_id)).size;

      // Get unique agents count
      const { data: uniqueAgents } = await supabaseAdmin
        .from("analytics")
        .select("agent_id")
        .not("agent_id", "is", null);

      const uniqueAgentsCount = new Set(uniqueAgents?.map((a) => a.agent_id)).size;

      // Get unique tenants count
      const { data: uniqueTenants } = await supabaseAdmin
        .from("analytics")
        .select("tenant_id")
        .not("tenant_id", "is", null);

      const uniqueTenantsCount = new Set(uniqueTenants?.map((t) => t.tenant_id)).size;

      logger.info("System analytics retrieved", {
        totalAnalytics,
        uniqueUsersCount,
        uniqueAgentsCount,
        uniqueTenantsCount,
      });

      return {
        totalAnalytics: totalAnalytics || 0,
        uniqueUsers: uniqueUsersCount,
        uniqueAgents: uniqueAgentsCount,
        uniqueTenants: uniqueTenantsCount,
      };
    } catch (error) {
      logger.error("System analytics service error", { error });
      throw error;
    }
  }

  /**
   * Format analytics data as CSV
   */
  formatAsCSV(analytics: AnalyticsRecord[]): string {
    const csvHeader = "Date,Agent ID,User ID,Query,Response Length,Vector Score\n";
    const csvData = analytics
      .map((a) => {
        const date = new Date(a.created_at).toISOString();
        const query = (a.query || "").replace(/"/g, '""');
        const response = (a.response || "").replace(/"/g, '""');
        return `"${date}","${a.agent_id}","${a.user_id}","${query}",${response.length},${a.vector_score || 0}`;
      })
      .join("\n");

    return csvHeader + csvData;
  }
}

// Create and export service instance
export const analyticsService = new AnalyticsService();

export default analyticsService;
