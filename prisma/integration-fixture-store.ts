import {
  DealStatus,
  EventStatus,
  EventType,
  ModuleTier,
  PlanTier,
  Prisma,
  PrismaClient,
  Priority,
  StrategyType,
  TaskStatus,
  TaskType,
  UserRole,
} from '../app/generated/prisma'
import type {
  IntegrationFixtureIdentity,
  IntegrationFixtureInspection,
  IntegrationFixtureStore,
} from '../lib/integration-fixture-reset'
import { matchesVerifiedPreviousClerkIdentity } from '../lib/integration-fixture-reset'
import type { IntegrationFixtureManifest } from './fixtures/integration-v1'

export class PrismaIntegrationFixtureStore implements IntegrationFixtureStore {
  constructor(private readonly prisma: PrismaClient) {}

  async inspect(
    manifest: IntegrationFixtureManifest
  ): Promise<IntegrationFixtureInspection> {
    const [fixtureTenants, stableTenant] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { fixtureSet: manifest.fixtureSet },
        select: {
          id: true,
          clerkOrgId: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          users: { select: { clerkUserId: true } },
          documents: { select: { r2Key: true } },
          _count: {
            select: {
              users: true,
              properties: true,
              deals: true,
              contacts: true,
              documents: true,
              emailEvents: true,
              auditLogs: true,
              auditEvents: true,
              modules: true,
              workflowRules: true,
              checklistTemplates: true,
            },
          },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: manifest.tenant.id },
        select: { fixtureSet: true },
      }),
    ])

    const fixture = fixtureTenants[0]
    const counts = fixture?._count

    return {
      fixtureTenantCount: fixtureTenants.length,
      fixtureTenantId: fixture?.id ?? null,
      clerkOrgId: fixture?.clerkOrgId ?? null,
      clerkUserIds: fixture?.users.map(user => user.clerkUserId) ?? [],
      r2ObjectCount: counts?.documents ?? 0,
      r2ObjectKeys: fixture?.documents.map(document => document.r2Key) ?? [],
      stripeArtifactCount:
        Number(Boolean(fixture?.stripeCustomerId)) + Number(Boolean(fixture?.stripeSubscriptionId)),
      stableTenantIdConflict: Boolean(
        stableTenant && stableTenant.fixtureSet !== manifest.fixtureSet
      ),
      databaseRowCounts: fixture
        ? {
            tenants: 1,
            users: counts?.users ?? 0,
            properties: counts?.properties ?? 0,
            deals: counts?.deals ?? 0,
            contacts: counts?.contacts ?? 0,
            documents: counts?.documents ?? 0,
            emailEvents: counts?.emailEvents ?? 0,
            auditLogs: counts?.auditLogs ?? 0,
            auditEvents: counts?.auditEvents ?? 0,
            modules: counts?.modules ?? 0,
            workflowRules: counts?.workflowRules ?? 0,
            checklistTemplates: counts?.checklistTemplates ?? 0,
          }
        : { tenants: 0 },
    }
  }

  async beginResetRun(input: {
    environmentId: string
    manifest: IntegrationFixtureManifest
    gitCommit: string
  }): Promise<string> {
    const run = await this.prisma.integrationResetRun.create({
      data: {
        environmentId: input.environmentId,
        fixtureSet: input.manifest.fixtureSet,
        fixtureVersion: input.manifest.fixtureVersion,
        gitCommit: input.gitCommit,
        requiredMigration: input.manifest.requiredMigration,
        status: 'STARTED',
      },
      select: { id: true },
    })
    return run.id
  }

  async replaceFixture(
    manifest: IntegrationFixtureManifest,
    identity: IntegrationFixtureIdentity,
    externalCleanup?: {
      verifiedEmptyR2Prefix: string
      replacedClerkIdentity: {
        previousOrgId: string | null
        previousUserIds: string[]
      }
    }
  ): Promise<Record<string, number>> {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.tenant.findUnique({
        where: { fixtureSet: manifest.fixtureSet },
        select: {
          id: true,
          clerkOrgId: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          users: { select: { clerkUserId: true } },
          documents: { select: { r2Key: true } },
        },
      })

      if (existing) {
        const tenantIdDrift = existing.id !== manifest.tenant.id
        const clerkIdentityDrift =
          existing.clerkOrgId !== identity.clerkOrgId ||
          existing.users.some(user => user.clerkUserId !== identity.clerkUserId)
        const clerkRotationIsVerified = matchesVerifiedPreviousClerkIdentity(
          existing.clerkOrgId,
          existing.users.map(user => user.clerkUserId),
          externalCleanup?.replacedClerkIdentity
        )
        const documentScopeIsVerified = existing.documents.every(document =>
          externalCleanup?.verifiedEmptyR2Prefix === manifest.r2Prefix &&
          document.r2Key.startsWith(manifest.r2Prefix)
        )
        const externalStateRemaining =
          (existing.documents.length > 0 && !documentScopeIsVerified) ||
          Boolean(existing.stripeCustomerId) ||
          Boolean(existing.stripeSubscriptionId)
        if (
          tenantIdDrift ||
          (clerkIdentityDrift && !clerkRotationIsVerified) ||
          externalStateRemaining
        ) {
          throw new Error('Fixture changed after reset planning')
        }

        await tx.emailEvent.deleteMany({ where: { tenantId: existing.id } })
        await tx.tenant.delete({ where: { id: existing.id } })
      }

      const jurisdiction = await tx.jurisdiction.findUniqueOrThrow({
        where: { fips: manifest.jurisdiction.fips },
        select: { id: true, state: true, county: true },
      })
      if (
        jurisdiction.state !== manifest.jurisdiction.state ||
        jurisdiction.county !== manifest.jurisdiction.county
      ) {
        throw new Error('Fixture jurisdiction identity mismatch')
      }

      await tx.tenant.create({
        data: {
          id: manifest.tenant.id,
          clerkOrgId: identity.clerkOrgId,
          name: manifest.tenant.name,
          slug: manifest.tenant.slug,
          plan: PlanTier[manifest.tenant.plan],
          fixtureSet: manifest.fixtureSet,
        },
      })
      await tx.user.create({
        data: {
          id: manifest.owner.id,
          clerkUserId: identity.clerkUserId,
          tenantId: manifest.tenant.id,
          role: UserRole[manifest.owner.role],
          email: identity.ownerEmail,
          name: manifest.owner.name,
        },
      })
      await tx.tenantModule.create({
        data: {
          id: manifest.module.id,
          tenantId: manifest.tenant.id,
          strategy: StrategyType[manifest.module.strategy],
          tier: ModuleTier[manifest.module.tier],
        },
      })
      await tx.investorProfile.create({
        data: {
          id: manifest.investorProfile.id,
          tenantId: manifest.tenant.id,
          maxPurchasePrice: manifest.investorProfile.maxPurchasePrice,
          improvementCapital: manifest.investorProfile.improvementCapital,
          holdMonthsTolerance: manifest.investorProfile.holdMonthsTolerance,
          targetRoi: manifest.investorProfile.targetRoi,
          financing: manifest.investorProfile.financing,
        },
      })
      await tx.property.create({
        data: {
          id: manifest.property.id,
          tenantId: manifest.tenant.id,
          jurisdictionId: jurisdiction.id,
          apn: manifest.property.apn,
          state: manifest.property.state,
          propertyType: manifest.property.propertyType,
        },
      })
      await tx.deal.create({
        data: {
          id: manifest.deal.id,
          tenantId: manifest.tenant.id,
          propertyId: manifest.property.id,
          strategyType: StrategyType[manifest.deal.strategyType],
          status: DealStatus[manifest.deal.status],
          purchasePrice: manifest.deal.purchasePrice,
          notes: manifest.deal.notes,
        },
      })
      await tx.dealTaxLien.create({
        data: {
          id: manifest.taxLien.id,
          dealId: manifest.deal.id,
          certificateNumber: manifest.taxLien.certificateNumber,
          faceAmount: manifest.taxLien.faceAmount,
          interestRate: manifest.taxLien.interestRate,
          maxBid: manifest.taxLien.maxBid,
          auctionDate: new Date(manifest.taxLien.auctionDate),
        },
      })
      await tx.event.create({
        data: {
          id: manifest.event.id,
          dealId: manifest.deal.id,
          eventType: EventType[manifest.event.eventType],
          label: manifest.event.label,
          dueDate: new Date(manifest.event.dueDate),
          status: EventStatus[manifest.event.status],
        },
      })
      await tx.task.create({
        data: {
          id: manifest.task.id,
          dealId: manifest.deal.id,
          eventId: manifest.event.id,
          assignedToId: manifest.owner.id,
          tenantId: manifest.tenant.id,
          taskType: TaskType[manifest.task.taskType],
          title: manifest.task.title,
          dueDate: new Date(manifest.task.dueDate),
          status: TaskStatus[manifest.task.status],
          priority: Priority[manifest.task.priority],
        },
      })

      return {
        tenants: 1,
        users: 1,
        modules: 1,
        investorProfiles: 1,
        properties: 1,
        deals: 1,
        taxLiens: 1,
        events: 1,
        tasks: 1,
      }
    })
  }

  async completeResetRun(runId: string, summary: Record<string, number>): Promise<void> {
    await this.prisma.integrationResetRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        summary: summary as Prisma.InputJsonObject,
      },
    })
  }

  async failResetRun(runId: string, errorCode: string): Promise<void> {
    await this.prisma.integrationResetRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorCode,
      },
    })
  }
}
