import type { GraphQLContext } from "~/src/graphql/context";
import { TalawaGraphQLError } from "~/src/utilities/TalawaGraphQLError";
import { AgendaFolder } from "./AgendaFolder";

export async function resolveCreatedAt(
  parent: AgendaFolder,
  _: unknown,
  ctx: GraphQLContext
) {
  if (!ctx.currentClient?.isAuthenticated) {
    throw new TalawaGraphQLError({ extensions: { code: "unauthenticated" } });
  }

  const currentUserId = ctx.currentClient.user.id;

  const [currentUser, existingEvent] = await Promise.all([
    ctx.drizzleClient.query.usersTable.findFirst({
      columns: { role: true },
      where: (fields, operators) => operators.eq(fields.id, currentUserId),
    }),
    ctx.drizzleClient.query.eventsTable.findFirst({
      columns: { startAt: true },
      where: (fields, operators) => operators.eq(fields.id, parent.eventId),
      with: {
        organization: {
          columns: { countryCode: true },
          with: {
            membershipsWhereOrganization: {
              columns: { role: true },
              where: (fields, operators) =>
                operators.eq(fields.memberId, currentUserId),
            },
          },
        },
      },
    }),
  ]);

  console.log("USER:", currentUser);
  console.log("EVENT: ", JSON.stringify(existingEvent, null, 2));

  if (currentUser === undefined) {
    throw new TalawaGraphQLError({ extensions: { code: "unauthenticated" } });
  }

  if (existingEvent === undefined) {
    ctx.log.error(
      "Postgres select operation returned an empty array for an agenda folder's event id that isn't null."
    );
    throw new TalawaGraphQLError({ extensions: { code: "unexpected" } });
  }

  const currentUserOrganizationMembership =
    existingEvent.organization.membershipsWhereOrganization[0];

  if (
    currentUser.role !== "administrator" &&
    (!currentUserOrganizationMembership ||
      currentUserOrganizationMembership.role !== "administrator")
  ) {
    throw new TalawaGraphQLError({
      extensions: { code: "unauthorized_action" },
    });
  }

  return parent.createdAt;
}

AgendaFolder.implement({
  fields: (t) => ({
    createdAt: t.field({
      description: "Date time at the time the agenda folder was created.",
      resolve: resolveCreatedAt,
      type: "DateTime",
    }),
  }),
});
