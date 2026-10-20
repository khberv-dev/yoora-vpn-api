import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1792498650354 implements MigrationInterface {
    name = 'Init1792498650354'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "chat_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chat_room_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "UQ_cd2185e924eb817ad406ac166c9" UNIQUE ("chat_room_id", "user_id"), CONSTRAINT "PK_aea646f59c92c47af5804ce73a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."chat_messages_type_enum" AS ENUM('text', 'photo', 'video')`);
        await queryRunner.query(`CREATE TYPE "public"."chat_messages_status_enum" AS ENUM('sent', 'read')`);
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."chat_messages_type_enum" NOT NULL, "status" "public"."chat_messages_status_enum" NOT NULL DEFAULT 'sent', "text" text, "file_path" character varying, "file_name" character varying, "file_size" integer, "file_mime_type" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chat_room_id" uuid NOT NULL, "sender_id" uuid NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eb032fdf515347a034de2e8a8c" ON "chat_messages" ("chat_room_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "chat_rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c69082bd83bffeb71b0f455bd59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "chat_members" ADD CONSTRAINT "FK_cad342d02c6db559add83de3359" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_members" ADD CONSTRAINT "FK_9dc61e92eed1dc151c2b2ef01a0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_3217ec6230770d4d2c826fc0380" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_9e5fc47ecb06d4d7b84633b1718"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_3217ec6230770d4d2c826fc0380"`);
        await queryRunner.query(`ALTER TABLE "chat_members" DROP CONSTRAINT "FK_9dc61e92eed1dc151c2b2ef01a0"`);
        await queryRunner.query(`ALTER TABLE "chat_members" DROP CONSTRAINT "FK_cad342d02c6db559add83de3359"`);
        await queryRunner.query(`DROP TABLE "chat_rooms"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb032fdf515347a034de2e8a8c"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP TYPE "public"."chat_messages_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."chat_messages_type_enum"`);
        await queryRunner.query(`DROP TABLE "chat_members"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
