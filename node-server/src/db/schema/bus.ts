import { createId } from "@paralleldrive/cuid2";
import { boolean, json, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const bus = pgTable('bus', {

  tripId:      text('tripId').primaryKey().$defaultFn(() => createId()),
  
  bus_number:  text('bus_number').notNull(),
  source:      text('source').notNull(),
  destination: text('destination').notNull(),
  
  route:       json("route").$type<string[]>().notNull(),
  
  status:      text("status").default("active").notNull(),
  current:     boolean("current").notNull().default(false),
  
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  endedAt:     timestamp("ended_at"),
})