import type { FastifyBaseLogger } from "fastify";
import { createMockLogger } from "test/utilities/mockLogger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "~/src/graphql/context";
import { resolveCreatedAt } from "~/src/graphql/types/AgendaFolder/createdAt";
import { TalawaGraphQLError } from "~/src/utilities/TalawaGraphQLError";

interface mockParent {
  createdAt: Date;
  name: string;
  id: string;
  creatorId: string;
  updatedAt: Date;
  updaterId: string;
  eventId: string;
  isAgendaItemFolder: boolean;
  parentFolderId: string;
}

interface TestContext extends Omit<GraphQLContext, "log" | "currentClient"> {
  log: FastifyBaseLogger;
  currentClient: {
    isAuthenticated: boolean;
    user: { id: string; role: "administrator" };
  };
  drizzleClient: {
    query: {
      usersTable: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      eventsTable: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  } & GraphQLContext["drizzleClient"];
}

describe("Agenda Folder Resolver -CreatedAt Test", () => {
  let mockCtx: TestContext;
  let mockParent: mockParent;

  const mockLogger = createMockLogger();

  beforeEach(() => {
    mockParent = {
      createdAt: new Date(),
      name: "Test Folder",
      id: "123",
      creatorId: "user-123",
      updatedAt: new Date(),
      updaterId: "id-321",
      eventId: "event-456",
      isAgendaItemFolder: false,
      parentFolderId: "folder-123",
    };
    mockCtx = {
      currentClient: {
        isAuthenticated: true,
        user: { id: "user123", role: "administrator" },
      },
      drizzleClient: {
        query: {
          usersTable: {
            findFirst: vi.fn(),
          },
          eventsTable: {
            findFirst: vi.fn(),
          },
        },
      },
      log: mockLogger,
    } as TestContext;
  });

  it("should throw 'unauthenticated' error if user is not authenticated", async () => {
    mockCtx.currentClient.isAuthenticated = false;

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthenticated" } })
    );
  });

  it("should throw 'unauthenticated' error if user does not exist", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue(
      undefined
    );

    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        countryCode: "US",
        membershipsWhereOrganization: [{ role: "member" }],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthenticated" } })
    );
  });

  it("should throw 'unexpected' error if event does not exist", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });

    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue(
      undefined
    );

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unexpected" } })
    );

    expect(mockCtx.log.error).toHaveBeenCalledWith(
      "Postgres select operation returned an empty array for an agenda folder's event id that isn't null."
    );
  });

  it("should throw 'unauthorized_action' error if user is not an administrator", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });
    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: [{ role: "member" }],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthorized_action" } })
    );
  });

  it("should return createdAt if user is an administrator", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "administrator",
    });

    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: [{ role: "member" }],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).resolves.toBe(mockParent.createdAt);
  });

  it("should throw unauthorized_action if membershipsWhereOrganization is undefined", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });
    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: [{ undefined }],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthorized_action" } })
    );
  });

  it("should throw unauthorized_action if membershipsWhereOrganization.role is not administrator", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });
    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: [{ role: "member" }],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthorized_action" } })
    );
  });

  it("should throw unauthorized_action if membershipsWhereOrganization is undefined", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });
    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: { undefined },
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthorized_action" } })
    );
  });

  it("should throw unauthorized_action if membershipsWhereOrganization is an empty array", async () => {
    mockCtx.drizzleClient.query.usersTable.findFirst.mockResolvedValue({
      role: "member",
    });
    mockCtx.drizzleClient.query.eventsTable.findFirst.mockResolvedValue({
      organization: {
        membershipsWhereOrganization: [],
      },
    });

    await expect(
      resolveCreatedAt(mockParent, {}, mockCtx as GraphQLContext)
    ).rejects.toThrow(
      new TalawaGraphQLError({ extensions: { code: "unauthorized_action" } })
    );
  });
});
