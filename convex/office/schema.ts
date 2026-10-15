import { defineTable } from 'convex/server';
import { v } from 'convex/values';
export const officeTables = {
  officeSetup: defineTable({
    worldId: v.id('worlds'),
    phase: v.literal('SETUP'),
    layoutVersion: v.number(),
    paused: v.boolean(),
    createdAt: v.number(),
  }).index('worldId', ['worldId']),
  employeeProfiles: defineTable({
    worldId: v.id('worlds'),
    employeeId: v.string(),
    playerId: v.string(),
    name: v.string(),
    specialty: v.string(),
    strategy: v.string(),
    deskX: v.number(),
    deskY: v.number(),
    profileVersion: v.number(),
    modelCandidate: v.string(),
    enabled: v.boolean(),
  }).index('worldId', ['worldId']),
  officeInstruments: defineTable({
    instrumentId: v.string(),
    selected: v.boolean(),
    entitlement: v.literal('UNVERIFIED'),
    updatedAt: v.number(),
  }).index('instrumentId', ['instrumentId']),
  officeAudit: defineTable({
    action: v.string(),
    employeeId: v.optional(v.string()),
    instrumentId: v.optional(v.string()),
    value: v.optional(v.string()),
    occurredAt: v.number(),
    actor: v.literal('owner'),
  }),
};
