import { createId } from "@paralleldrive/cuid2";
import { boolean, json, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const bus = pgTable('bus',{
  tripId: text('tripId').primaryKey().$defaultFn(() => createId()),
  bus_number: text('bus_number').notNull().unique(),
  source: text('source').notNull(),
  destination: text('destination').notNull(),
  route: json("route").$type<string[]>().notNull(),
  current: boolean("current").notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})


// source: text("source").notNull()
// |            |
// |            |  > it is the column name in the database
// > it is typescript so we can use like bus.source