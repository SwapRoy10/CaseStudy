-- CreateEnum
CREATE TYPE "GradeGoal" AS ENUM ('A_TRACK', 'PASS_TRACK');

-- CreateEnum
CREATE TYPE "WorkStyle" AS ENUM ('SOLO', 'GROUP');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- CreateTable
CREATE TABLE "student" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "school_email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "tutorial_completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "term" TEXT NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "student_id" BIGINT NOT NULL,
    "course_id" BIGINT NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("student_id","course_id")
);

-- CreateTable
CREATE TABLE "profile" (
    "id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "course_id" BIGINT NOT NULL,
    "grade_goal" "GradeGoal" NOT NULL,
    "work_style" "WorkStyle" NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_block" (
    "id" BIGSERIAL NOT NULL,
    "profile_id" BIGINT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,

    CONSTRAINT "availability_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_request" (
    "id" BIGSERIAL NOT NULL,
    "requester_id" BIGINT NOT NULL,
    "recipient_id" BIGINT NOT NULL,
    "course_id" BIGINT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,

    CONSTRAINT "match_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_group" (
    "id" BIGSERIAL NOT NULL,
    "course_id" BIGINT NOT NULL,
    "formed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_membership" (
    "group_id" BIGINT NOT NULL,
    "student_id" BIGINT NOT NULL,
    "course_id" BIGINT NOT NULL,

    CONSTRAINT "group_membership_pkey" PRIMARY KEY ("group_id","student_id")
);

-- CreateTable
CREATE TABLE "peer_review" (
    "id" BIGSERIAL NOT NULL,
    "reviewer_id" BIGINT NOT NULL,
    "reviewee_id" BIGINT NOT NULL,
    "group_id" BIGINT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_criterion" (
    "review_id" BIGINT NOT NULL,
    "criteria_name" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,

    CONSTRAINT "rating_criterion_pkey" PRIMARY KEY ("review_id","criteria_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_school_email_key" ON "student"("school_email");

-- CreateIndex
CREATE UNIQUE INDEX "course_code_section_term_key" ON "course"("code", "section", "term");

-- CreateIndex
CREATE INDEX "profile_course_id_grade_goal_idx" ON "profile"("course_id", "grade_goal");

-- CreateIndex
CREATE UNIQUE INDEX "profile_student_id_course_id_key" ON "profile"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "availability_block_profile_id_weekday_idx" ON "availability_block"("profile_id", "weekday");

-- CreateIndex
CREATE INDEX "match_request_course_id_status_idx" ON "match_request"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "study_group_id_course_id_key" ON "study_group"("id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_membership_student_id_course_id_key" ON "group_membership"("student_id", "course_id");

-- CreateIndex
CREATE INDEX "peer_review_reviewee_id_idx" ON "peer_review"("reviewee_id");

-- CreateIndex
CREATE UNIQUE INDEX "peer_review_reviewer_id_reviewee_id_group_id_key" ON "peer_review"("reviewer_id", "reviewee_id", "group_id");

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile" ADD CONSTRAINT "profile_student_id_course_id_fkey" FOREIGN KEY ("student_id", "course_id") REFERENCES "enrollment"("student_id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_block" ADD CONSTRAINT "availability_block_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_request" ADD CONSTRAINT "match_request_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_group" ADD CONSTRAINT "study_group_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_group_id_course_id_fkey" FOREIGN KEY ("group_id", "course_id") REFERENCES "study_group"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_membership" ADD CONSTRAINT "group_membership_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review" ADD CONSTRAINT "peer_review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review" ADD CONSTRAINT "peer_review_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review" ADD CONSTRAINT "peer_review_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "study_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_criterion" ADD CONSTRAINT "rating_criterion_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "peer_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "availability_block" ADD CONSTRAINT "weekday_range" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "availability_block" ADD CONSTRAINT "minute_range" CHECK ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440);
ALTER TABLE "match_request" ADD CONSTRAINT "no_self_request" CHECK ("requester_id" <> "recipient_id");
ALTER TABLE "peer_review" ADD CONSTRAINT "no_self_review" CHECK ("reviewer_id" <> "reviewee_id");
ALTER TABLE "rating_criterion" ADD CONSTRAINT "rating_range" CHECK ("rating" BETWEEN 1 AND 5);
CREATE UNIQUE INDEX "one_pending_request" ON "match_request" ("requester_id", "recipient_id", "course_id") WHERE "status" = 'PENDING';