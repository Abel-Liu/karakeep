import { and, eq, like, or, sql } from "drizzle-orm";

import type {
  BookmarkSearchDocument,
  SearchIndexClient,
  SearchOptions,
  SearchResponse,
} from "@karakeep/shared/search";
import { PluginProvider } from "@karakeep/shared/plugins";
import { db } from "@karakeep/db";
import { bookmarks, bookmarkLinks } from "@karakeep/db/schema";
import { envConfig } from "./env";
import logger from "@karakeep/shared/logger";

class SQLiteIndexClient implements SearchIndexClient {
  async addDocuments(documents: BookmarkSearchDocument[]): Promise<void> {
    // SQLite LIKE 搜索不需要预建索引，直接存储文档即可
    console.log(`Indexed ${documents.length} documents for SQLite search`);
  }

  async updateDocuments(documents: BookmarkSearchDocument[]): Promise<void> {
    await this.addDocuments(documents);
  }

  async deleteDocument(id: string): Promise<void> {
    // 无需操作，因为我们是实时查询
    console.log(`Deleted document ${id} from SQLite search`);
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    console.log(`Deleted ${ids.length} documents from SQLite search`);
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    const { query, filter = [], limit = 20, offset = 0 } = options;

    const startTime = Date.now();

    // 解析用户ID过滤器
    let userId: string | undefined;
    for (const f of filter) {
      const match = f.match(/userId = '([^']+)'/);
      if (match) {
        userId = match[1];
        break;
      }
    }

    if (!userId) {
      return {
        hits: [],
        totalHits: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 构建搜索条件
    const searchTerm = `%${query}%`;

    // 构建复杂的LIKE查询
    const searchConditions = or(
      like(bookmarks.title, searchTerm),
      like(bookmarks.note, searchTerm),
      like(bookmarks.summary, searchTerm),
      like(bookmarkLinks.title, searchTerm),
      like(bookmarkLinks.description, searchTerm),
      like(bookmarkLinks.url, searchTerm)
    );

    // 获取搜索结果
    const searchResults = await db.select({
      id: bookmarks.id,
      title: bookmarks.title,
      note: bookmarks.note,
      summary: bookmarks.summary,
      createdAt: bookmarks.createdAt,
      modifiedAt: bookmarks.modifiedAt,
      link: bookmarkLinks,
    })
      .from(bookmarks)
      .leftJoin(bookmarkLinks, eq(bookmarks.id, bookmarkLinks.id))
      .where(
        and(
          eq(bookmarks.userId, userId),
          searchConditions
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${bookmarks.createdAt} DESC`);

    // 获取总数
    const countResult = await db.select({
      count: sql<number>`count(*)`
    })
      .from(bookmarks)
      .leftJoin(bookmarkLinks, eq(bookmarks.id, bookmarkLinks.id))
      .where(
        and(
          eq(bookmarks.userId, userId),
          searchConditions
        )
      );

    logger.info(`Search count:${JSON.stringify(countResult)}`);

    const totalHits = countResult[0]?.count || 0;

    // 计算相关性分数（简单的词频统计）
    const hits = searchResults.map((bookmark, index) => {
      let score = 1.0 - (index * 0.1); // 简单的时间衰减分数

      // 提高标题匹配的权重
      if (bookmark.title?.toLowerCase().includes(query.toLowerCase())) {
        score += 0.5;
      }

      // 提高URL匹配的权重
      if (bookmark.link?.url?.toLowerCase().includes(query.toLowerCase())) {
        score += 0.5;
      }

      return {
        id: bookmark.id,
        score: Math.min(score, 1.0),
      };
    });

    hits.sort((a, b) => b.score - a.score);

    return {
      hits,
      totalHits: Number(totalHits),
      processingTimeMs: Date.now() - startTime,
    };
  }

  async clearIndex(): Promise<void> {
    console.log("Cleared SQLite search index");
  }
}

export class SQLiteSearchProvider implements PluginProvider<SearchIndexClient> {
  private client!: SQLiteIndexClient;

  constructor() {
    if (SQLiteSearchProvider.isConfigured()) {
      this.client = new SQLiteIndexClient();
    }
  }

  static isConfigured(): boolean {
    return envConfig.USE_SQLITE_SEARCH;
  }

  async getClient(): Promise<SearchIndexClient | null> {
    return this.client;
  }
}