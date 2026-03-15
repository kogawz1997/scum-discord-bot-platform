# คู่มือตั้งค่า Admin SSO Role Mapping

เอกสารนี้สรุปวิธี map Discord role ไปเป็นสิทธิ์ `owner / admin / mod` สำหรับ admin web

## ใช้เมื่อไร

- เมื่อเปิด `ADMIN_WEB_SSO_DISCORD_ENABLED=true`
- เมื่อไม่ต้องการให้ทุกคนที่ login ผ่าน Discord SSO ได้สิทธิ์ตาม `ADMIN_WEB_SSO_DEFAULT_ROLE` เหมือนกันทั้งหมด

## Env ที่เกี่ยวข้อง

- `ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_IDS`
- `ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_IDS`
- `ADMIN_WEB_SSO_DISCORD_MOD_ROLE_IDS`
- `ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_NAMES`
- `ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_NAMES`
- `ADMIN_WEB_SSO_DISCORD_MOD_ROLE_NAMES`
- `ADMIN_WEB_SSO_DEFAULT_ROLE`

ถ้ายังไม่ตั้ง role ids หรือ role names เลย ระบบจะ fallback ไปใช้ `ADMIN_WEB_SSO_DEFAULT_ROLE`

## วิธีดึง role ids

ใช้คำสั่งนี้เพื่อดึง roles จาก guild และ generate env lines พร้อมใช้:

```bat
npm run admin:sso:roles -- --owner "Owner Role" --admin "Admin Role" --mod "Moderator Role"
```

คำสั่งจะใช้:
- `DISCORD_TOKEN`
- `ADMIN_WEB_SSO_DISCORD_GUILD_ID` หรือ `DISCORD_GUILD_ID`

ผลลัพธ์จะมีทั้ง:
- รายชื่อ roles ใน guild
- env lines สำหรับนำไปใส่ใน `.env`

ตัวอย่าง output:

```env
ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_IDS=123456789012345678
ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_IDS=234567890123456789
ADMIN_WEB_SSO_DISCORD_MOD_ROLE_IDS=345678901234567890
```

ถ้ายังดึง role ids ไม่ได้ ระบบรองรับการตั้งแบบ role names ได้ด้วย ตัวอย่าง:

```env
ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_NAMES=Owner
ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_NAMES=Admin
ADMIN_WEB_SSO_DISCORD_MOD_ROLE_NAMES=Moderator
```

## แนวทางแนะนำ

1. ตั้ง `ADMIN_WEB_SSO_DEFAULT_ROLE=mod` ไว้เป็น baseline
2. map role ที่ต้องการยกระดับเป็น `admin` หรือ `owner` ผ่าน env ด้านบน
3. รัน `npm run doctor` และ `npm run security:check` หลังแก้ env
4. ทดสอบ `npm run smoke:postdeploy` หลัง restart runtime

## หมายเหตุ

- ถ้า role name ซ้ำหรือ match หลายตัว สคริปต์จะฟ้องให้เลือกชื่อ role ให้ชัดขึ้น
- ถ้ายังไม่พร้อม map ละเอียด ระบบยังใช้งานได้ แต่จะมี warning ใน `doctor` และ `security:check`
