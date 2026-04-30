import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1777532789264 implements MigrationInterface {
    name = 'InitialSchema1777532789264'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "conductor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "licenseNumber" character varying NOT NULL, "licenseExpiryDate" TIMESTAMP NOT NULL, "licenseDoc" character varying NOT NULL, "contactNumber" character varying NOT NULL, "isLicenseVerified" boolean NOT NULL DEFAULT false, "userId" uuid, CONSTRAINT "REL_b6d1547bd3991be8507aef32e8" UNIQUE ("userId"), CONSTRAINT "PK_081ad11134847923a19823b64bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "customer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "contactNumber" character varying NOT NULL, "address" character varying NOT NULL, "userId" uuid, CONSTRAINT "REL_3f62b42ed23958b120c235f74d" UNIQUE ("userId"), CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "UQ_user_role_userId_roleId" UNIQUE ("userId", "roleId"), CONSTRAINT "PK_fb2e442d14add3cefbdf33c4561" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "password" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying, "isVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_8e1f623798118e629b46a9e6299" UNIQUE ("phone"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bus_owner" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "contactNumber" character varying NOT NULL, "nicNumber" character varying NOT NULL, "address" text NOT NULL, "userId" uuid, CONSTRAINT "UQ_55817cec4a8ade4962b66748d20" UNIQUE ("nicNumber"), CONSTRAINT "REL_1ea7999aebcb16046c169054d2" UNIQUE ("userId"), CONSTRAINT "PK_95d8b3c5ae45048e3dc05646b87" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."bus_document_documenttype_enum" AS ENUM('RC', 'INSURANCE', 'FITNESS', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "bus_document" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentType" "public"."bus_document_documenttype_enum" NOT NULL, "fileData" text NOT NULL, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), "verifiedAt" TIMESTAMP, "verifiedByAdminId" uuid, "busId" uuid, CONSTRAINT "PK_83c72781086df64c933f7ed50e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."bus_approvalstatus_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "bus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "registrationNumber" character varying NOT NULL, "model" character varying NOT NULL, "year" smallint NOT NULL, "totalSeats" smallint NOT NULL, "seatLayoutJson" jsonb NOT NULL, "approvalStatus" "public"."bus_approvalstatus_enum" NOT NULL DEFAULT 'PENDING', "rejectionReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid, CONSTRAINT "UQ_c722b056705208cdc287171d103" UNIQUE ("registrationNumber"), CONSTRAINT "PK_bd7b8b319eb7958e876584d02d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "route" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "origin" character varying NOT NULL, "destination" character varying NOT NULL, "viaStops" jsonb NOT NULL DEFAULT '[]', "distanceKm" numeric(7,2) NOT NULL, "estimatedDurationMin" integer NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid, CONSTRAINT "PK_08affcd076e46415e5821acf52d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "schedule" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "departureTime" TIME NOT NULL, "operatingDays" smallint NOT NULL, "baseFare" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "busId" uuid, "routeId" uuid, CONSTRAINT "PK_1c05e42aec7371641193e180046" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trip_availability" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tripDate" date NOT NULL, "isAvailable" boolean NOT NULL DEFAULT true, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "scheduleId" uuid, "setByUserId" uuid, CONSTRAINT "UQ_trip_availability" UNIQUE ("scheduleId", "tripDate"), CONSTRAINT "PK_5ef84dd64a69645fd4ddfd2d46c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "coupon_usage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "discountAmount" numeric(10,2) NOT NULL, "usedAt" TIMESTAMP NOT NULL DEFAULT now(), "couponId" uuid, "customerId" uuid, "bookingId" uuid, CONSTRAINT "REL_82fe5f8b6a70455901f54f7608" UNIQUE ("bookingId"), CONSTRAINT "PK_5727b2e426ee3e63c3f5e200e61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."coupon_discounttype_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')`);
        await queryRunner.query(`CREATE TABLE "coupon" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "description" character varying, "discountType" "public"."coupon_discounttype_enum" NOT NULL, "discountValue" numeric(10,2) NOT NULL, "minFare" numeric(10,2), "maxDiscount" numeric(10,2), "usageLimit" integer, "usedCount" integer NOT NULL DEFAULT '0', "perUserLimit" integer NOT NULL DEFAULT '1', "validFrom" date NOT NULL, "validUntil" date NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_62d3c5b0ce63a82c48e86d904bc" UNIQUE ("code"), CONSTRAINT "PK_fcbe9d72b60eed35f46dc35a682" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "booked_seat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tripDate" date NOT NULL, "seatNumber" character varying NOT NULL, "bookingId" uuid, "scheduleId" uuid, CONSTRAINT "UQ_booked_seat" UNIQUE ("scheduleId", "tripDate", "seatNumber"), CONSTRAINT "PK_c587d185a50617c7d7c86fb74e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."booking_status_enum" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'BOARDED')`);
        await queryRunner.query(`CREATE TABLE "booking" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tripDate" date NOT NULL, "seatNumbers" jsonb NOT NULL, "totalFare" numeric(10,2) NOT NULL, "discountAmount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."booking_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "bookedAt" TIMESTAMP NOT NULL DEFAULT now(), "cancelledAt" TIMESTAMP, "customerId" uuid, "scheduleId" uuid, "couponId" uuid, CONSTRAINT "PK_49171efc69702ed84c812f33540" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payment_paymentmethod_enum" AS ENUM('CASH', 'CARD', 'MOBILE_WALLET')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(10,2) NOT NULL, "paymentMethod" "public"."payment_paymentmethod_enum" NOT NULL, "status" "public"."payment_status_enum" NOT NULL DEFAULT 'COMPLETED', "transactionRef" character varying, "paidAt" TIMESTAMP, "refundedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "bookingId" uuid, CONSTRAINT "REL_5738278c92c15e1ec9d27e3a09" UNIQUE ("bookingId"), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bus_assignment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isActive" boolean NOT NULL DEFAULT true, "assignedAt" TIMESTAMP NOT NULL DEFAULT now(), "busId" uuid, "conductorId" uuid, CONSTRAINT "UQ_bus_assignment" UNIQUE ("busId", "conductorId"), CONSTRAINT "PK_6ce6e6f312a28605cd800375b04" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "conductor" ADD CONSTRAINT "FK_b6d1547bd3991be8507aef32e87" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer" ADD CONSTRAINT "FK_3f62b42ed23958b120c235f74df" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_role" ADD CONSTRAINT "FK_ab40a6f0cd7d3ebfcce082131fd" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_role" ADD CONSTRAINT "FK_dba55ed826ef26b5b22bd39409b" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bus_owner" ADD CONSTRAINT "FK_1ea7999aebcb16046c169054d2e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bus_document" ADD CONSTRAINT "FK_26fcf39dff2f6bb2641a975a1ed" FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bus" ADD CONSTRAINT "FK_c31deb5270c7148015a0044f643" FOREIGN KEY ("ownerId") REFERENCES "bus_owner"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "route" ADD CONSTRAINT "FK_edad28fb2a50dba58be455ef1ed" FOREIGN KEY ("ownerId") REFERENCES "bus_owner"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schedule" ADD CONSTRAINT "FK_845b3ed2f71d64421b2dfa24af2" FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schedule" ADD CONSTRAINT "FK_3b4f19c3286140b393ee9af676e" FOREIGN KEY ("routeId") REFERENCES "route"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_availability" ADD CONSTRAINT "FK_b869cef3dd508b8fbbce37c8ea7" FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_availability" ADD CONSTRAINT "FK_d47564d2066b46f61c695490dc0" FOREIGN KEY ("setByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" ADD CONSTRAINT "FK_18b10b5df91ce11abe764e6edda" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" ADD CONSTRAINT "FK_0c6a21edb5b4207297c57134793" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" ADD CONSTRAINT "FK_82fe5f8b6a70455901f54f7608f" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booked_seat" ADD CONSTRAINT "FK_c8554b0bbe388e1e56e5275e200" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booked_seat" ADD CONSTRAINT "FK_70483cabc71fcd04d810c4c3873" FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "FK_72e32d29a7de28b3c469f858d56" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "FK_2427b072768ad4b322d58a952d2" FOREIGN KEY ("scheduleId") REFERENCES "schedule"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "FK_52330efcc8349a4bd192d7b19ad" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_5738278c92c15e1ec9d27e3a098" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bus_assignment" ADD CONSTRAINT "FK_c2667c14d4daefca56928aac5ae" FOREIGN KEY ("busId") REFERENCES "bus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bus_assignment" ADD CONSTRAINT "FK_e3198368287a72a6370a8d540ac" FOREIGN KEY ("conductorId") REFERENCES "conductor"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bus_assignment" DROP CONSTRAINT "FK_e3198368287a72a6370a8d540ac"`);
        await queryRunner.query(`ALTER TABLE "bus_assignment" DROP CONSTRAINT "FK_c2667c14d4daefca56928aac5ae"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_5738278c92c15e1ec9d27e3a098"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "FK_52330efcc8349a4bd192d7b19ad"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "FK_2427b072768ad4b322d58a952d2"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "FK_72e32d29a7de28b3c469f858d56"`);
        await queryRunner.query(`ALTER TABLE "booked_seat" DROP CONSTRAINT "FK_70483cabc71fcd04d810c4c3873"`);
        await queryRunner.query(`ALTER TABLE "booked_seat" DROP CONSTRAINT "FK_c8554b0bbe388e1e56e5275e200"`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" DROP CONSTRAINT "FK_82fe5f8b6a70455901f54f7608f"`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" DROP CONSTRAINT "FK_0c6a21edb5b4207297c57134793"`);
        await queryRunner.query(`ALTER TABLE "coupon_usage" DROP CONSTRAINT "FK_18b10b5df91ce11abe764e6edda"`);
        await queryRunner.query(`ALTER TABLE "trip_availability" DROP CONSTRAINT "FK_d47564d2066b46f61c695490dc0"`);
        await queryRunner.query(`ALTER TABLE "trip_availability" DROP CONSTRAINT "FK_b869cef3dd508b8fbbce37c8ea7"`);
        await queryRunner.query(`ALTER TABLE "schedule" DROP CONSTRAINT "FK_3b4f19c3286140b393ee9af676e"`);
        await queryRunner.query(`ALTER TABLE "schedule" DROP CONSTRAINT "FK_845b3ed2f71d64421b2dfa24af2"`);
        await queryRunner.query(`ALTER TABLE "route" DROP CONSTRAINT "FK_edad28fb2a50dba58be455ef1ed"`);
        await queryRunner.query(`ALTER TABLE "bus" DROP CONSTRAINT "FK_c31deb5270c7148015a0044f643"`);
        await queryRunner.query(`ALTER TABLE "bus_document" DROP CONSTRAINT "FK_26fcf39dff2f6bb2641a975a1ed"`);
        await queryRunner.query(`ALTER TABLE "bus_owner" DROP CONSTRAINT "FK_1ea7999aebcb16046c169054d2e"`);
        await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "FK_dba55ed826ef26b5b22bd39409b"`);
        await queryRunner.query(`ALTER TABLE "user_role" DROP CONSTRAINT "FK_ab40a6f0cd7d3ebfcce082131fd"`);
        await queryRunner.query(`ALTER TABLE "customer" DROP CONSTRAINT "FK_3f62b42ed23958b120c235f74df"`);
        await queryRunner.query(`ALTER TABLE "conductor" DROP CONSTRAINT "FK_b6d1547bd3991be8507aef32e87"`);
        await queryRunner.query(`DROP TABLE "bus_assignment"`);
        await queryRunner.query(`DROP TABLE "payment"`);
        await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_paymentmethod_enum"`);
        await queryRunner.query(`DROP TABLE "booking"`);
        await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
        await queryRunner.query(`DROP TABLE "booked_seat"`);
        await queryRunner.query(`DROP TABLE "coupon"`);
        await queryRunner.query(`DROP TYPE "public"."coupon_discounttype_enum"`);
        await queryRunner.query(`DROP TABLE "coupon_usage"`);
        await queryRunner.query(`DROP TABLE "trip_availability"`);
        await queryRunner.query(`DROP TABLE "schedule"`);
        await queryRunner.query(`DROP TABLE "route"`);
        await queryRunner.query(`DROP TABLE "bus"`);
        await queryRunner.query(`DROP TYPE "public"."bus_approvalstatus_enum"`);
        await queryRunner.query(`DROP TABLE "bus_document"`);
        await queryRunner.query(`DROP TYPE "public"."bus_document_documenttype_enum"`);
        await queryRunner.query(`DROP TABLE "bus_owner"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "user_role"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "customer"`);
        await queryRunner.query(`DROP TABLE "conductor"`);
    }

}
