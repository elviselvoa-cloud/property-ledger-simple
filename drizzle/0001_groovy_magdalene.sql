CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`landlordId` int,
	`action` varchar(100) NOT NULL,
	`entity` varchar(100),
	`entityId` int,
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`tenantId` int,
	`leaseId` int,
	`paymentId` int,
	`name` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100),
	`fileSize` bigint,
	`documentType` enum('lease_agreement','tenant_id','payment_receipt','property_photo','other') NOT NULL DEFAULT 'other',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landlords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessName` varchar(255),
	`phone` varchar(30),
	`address` text,
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'Kenya',
	`subscriptionPlan` enum('free','basic','pro') NOT NULL DEFAULT 'free',
	`subscriptionStatus` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
	`subscriptionExpiresAt` timestamp,
	`trialEndsAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landlords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`tenantId` int NOT NULL,
	`unitId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`rentAmount` decimal(12,2) NOT NULL,
	`depositAmount` decimal(12,2),
	`depositPaid` boolean NOT NULL DEFAULT false,
	`rentDueDay` int NOT NULL DEFAULT 1,
	`status` enum('active','expired','terminated','pending') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`tenantId` int,
	`type` enum('rent_reminder','payment_confirmation','overdue_alert','subscription_expiry','general') NOT NULL,
	`channel` enum('sms','email','in_app') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` enum('pending','sent','failed','read') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`readAt` timestamp,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`invoiceId` int,
	`tenantId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`paymentMethod` enum('mpesa','bank_transfer','cash','other') NOT NULL,
	`mpesaTransactionId` varchar(100),
	`bankReference` varchar(100),
	`receiptNumber` varchar(100),
	`paymentDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	`city` varchar(100),
	`propertyType` enum('residential','commercial','mixed') NOT NULL DEFAULT 'residential',
	`totalUnits` int NOT NULL DEFAULT 1,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rent_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`leaseId` int NOT NULL,
	`tenantId` int NOT NULL,
	`unitId` int NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`periodMonth` int NOT NULL,
	`periodYear` int NOT NULL,
	`status` enum('pending','paid','overdue','partial','cancelled') NOT NULL DEFAULT 'pending',
	`paidAmount` decimal(12,2) DEFAULT '0',
	`paidAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rent_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `rent_invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` enum('free','basic','pro') NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`maxUnits` int,
	`maxProperties` int,
	`features` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('active','cancelled','expired','past_due') NOT NULL DEFAULT 'active',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`amount` decimal(10,2) NOT NULL,
	`paymentMethod` varchar(50),
	`mpesaTransactionId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landlordId` int NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(30),
	`nationalId` varchar(50),
	`emergencyContact` varchar(100),
	`emergencyPhone` varchar(30),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`landlordId` int NOT NULL,
	`unitNumber` varchar(50) NOT NULL,
	`floor` varchar(20),
	`bedrooms` int DEFAULT 1,
	`bathrooms` int DEFAULT 1,
	`size` decimal(10,2),
	`rentAmount` decimal(12,2) NOT NULL,
	`depositAmount` decimal(12,2),
	`status` enum('vacant','occupied','maintenance') NOT NULL DEFAULT 'vacant',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_leaseId_leases_id_fk` FOREIGN KEY (`leaseId`) REFERENCES `leases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landlords` ADD CONSTRAINT `landlords_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leases` ADD CONSTRAINT `leases_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leases` ADD CONSTRAINT `leases_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leases` ADD CONSTRAINT `leases_unitId_units_id_fk` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_rent_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `rent_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rent_invoices` ADD CONSTRAINT `rent_invoices_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rent_invoices` ADD CONSTRAINT `rent_invoices_leaseId_leases_id_fk` FOREIGN KEY (`leaseId`) REFERENCES `leases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rent_invoices` ADD CONSTRAINT `rent_invoices_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rent_invoices` ADD CONSTRAINT `rent_invoices_unitId_units_id_fk` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `units` ADD CONSTRAINT `units_propertyId_properties_id_fk` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `units` ADD CONSTRAINT `units_landlordId_landlords_id_fk` FOREIGN KEY (`landlordId`) REFERENCES `landlords`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_userId_idx` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_logs_landlordId_idx` ON `audit_logs` (`landlordId`);--> statement-breakpoint
CREATE INDEX `documents_landlordId_idx` ON `documents` (`landlordId`);--> statement-breakpoint
CREATE INDEX `documents_tenantId_idx` ON `documents` (`tenantId`);--> statement-breakpoint
CREATE INDEX `documents_leaseId_idx` ON `documents` (`leaseId`);--> statement-breakpoint
CREATE INDEX `landlords_userId_idx` ON `landlords` (`userId`);--> statement-breakpoint
CREATE INDEX `leases_landlordId_idx` ON `leases` (`landlordId`);--> statement-breakpoint
CREATE INDEX `leases_tenantId_idx` ON `leases` (`tenantId`);--> statement-breakpoint
CREATE INDEX `leases_unitId_idx` ON `leases` (`unitId`);--> statement-breakpoint
CREATE INDEX `notifications_landlordId_idx` ON `notifications` (`landlordId`);--> statement-breakpoint
CREATE INDEX `notifications_tenantId_idx` ON `notifications` (`tenantId`);--> statement-breakpoint
CREATE INDEX `payments_landlordId_idx` ON `payments` (`landlordId`);--> statement-breakpoint
CREATE INDEX `payments_invoiceId_idx` ON `payments` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `payments_tenantId_idx` ON `payments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `properties_landlordId_idx` ON `properties` (`landlordId`);--> statement-breakpoint
CREATE INDEX `invoices_landlordId_idx` ON `rent_invoices` (`landlordId`);--> statement-breakpoint
CREATE INDEX `invoices_leaseId_idx` ON `rent_invoices` (`leaseId`);--> statement-breakpoint
CREATE INDEX `invoices_tenantId_idx` ON `rent_invoices` (`tenantId`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `rent_invoices` (`status`);--> statement-breakpoint
CREATE INDEX `subscriptions_landlordId_idx` ON `subscriptions` (`landlordId`);--> statement-breakpoint
CREATE INDEX `tenants_landlordId_idx` ON `tenants` (`landlordId`);--> statement-breakpoint
CREATE INDEX `units_propertyId_idx` ON `units` (`propertyId`);--> statement-breakpoint
CREATE INDEX `units_landlordId_idx` ON `units` (`landlordId`);