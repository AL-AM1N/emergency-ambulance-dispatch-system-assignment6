-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('MEDICAL', 'ACCIDENT', 'FIRE', 'CARDIAC', 'TRAUMA', 'OBSTETRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'PICKED_UP', 'HOSPITAL_ARRIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HospitalType" AS ENUM ('GENERAL', 'EMERGENCY', 'TRAUMA', 'SPECIALIZED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'SSLCOMMERZ');

-- CreateTable
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ambulanceTypeId" TEXT NOT NULL,
    "driverId" TEXT,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perKmRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_requests" (
    "id" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientContact" TEXT NOT NULL,
    "emergencyType" "EmergencyType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "pickupLocation" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "additionalNote" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'PENDING',
    "fare" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "assignedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "ambulanceId" TEXT,
    "driverId" TEXT,
    "hospitalId" TEXT,

    CONSTRAINT "emergency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactNumber" TEXT,
    "email" TEXT,
    "type" "HospitalType" NOT NULL DEFAULT 'GENERAL',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_vehicleNumber_key" ON "ambulances"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_driverId_key" ON "ambulances"("driverId");

-- CreateIndex
CREATE INDEX "idx_ambulance_status" ON "ambulances"("status");

-- CreateIndex
CREATE INDEX "idx_ambulance_isDeleted" ON "ambulances"("isDeleted");

-- CreateIndex
CREATE INDEX "idx_ambulance_ambulanceTypeId" ON "ambulances"("ambulanceTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_types_name_key" ON "ambulance_types"("name");

-- CreateIndex
CREATE INDEX "idx_ambulanceType_isActive" ON "ambulance_types"("isActive");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_patientId" ON "emergency_requests"("patientId");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_driverId" ON "emergency_requests"("driverId");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_ambulanceId" ON "emergency_requests"("ambulanceId");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_hospitalId" ON "emergency_requests"("hospitalId");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_status" ON "emergency_requests"("status");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_priority" ON "emergency_requests"("priority");

-- CreateIndex
CREATE INDEX "idx_emergencyRequest_createdAt" ON "emergency_requests"("createdAt");

-- CreateIndex
CREATE INDEX "idx_hospital_isActive" ON "hospitals"("isActive");

-- CreateIndex
CREATE INDEX "idx_hospital_isDeleted" ON "hospitals"("isDeleted");

-- CreateIndex
CREATE INDEX "idx_hospital_type" ON "hospitals"("type");

-- CreateIndex
CREATE INDEX "idx_notification_userId" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "idx_notification_isRead" ON "notifications"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tripId_key" ON "payments"("tripId");

-- CreateIndex
CREATE INDEX "idx_payment_userId" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "idx_payment_tripId" ON "payments"("tripId");

-- CreateIndex
CREATE INDEX "idx_payment_status" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_ambulanceTypeId_fkey" FOREIGN KEY ("ambulanceTypeId") REFERENCES "ambulance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "emergency_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
