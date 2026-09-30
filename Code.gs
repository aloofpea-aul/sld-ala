/**
 * Single Line Diagram - สถานีไฟฟ้าอ่าวลึก
 * Google Apps Script Web App (backend API)
 *
 * ★ ไฟล์นี้ = Code.gs เดิม + ส่วน Patrol ระบบจำหน่าย (เฟส 1) รวมไว้แล้วในไฟล์เดียว
 *   วางทับ Code.gs เดิมได้เลย ไม่ต้องแก้อะไรเพิ่ม
 *   จุดที่เพิ่มจากของเดิมมี 2 จุด
 *     1) ใน doPost แทรกการเรียก handlePatrolAction_ ก่อนบรรทัด unknown action
 *     2) ส่วน Patrol ทั้งหมดอยู่ท้ายไฟล์ (มองหาหัวข้อ "Patrol ระบบจำหน่าย")
 *   หลังวางแล้วให้ Run ฟังก์ชัน patrolSetup 1 ครั้ง เพื่อสร้างชีตของ Patrol
 *   แล้ว Deploy ใหม่ (Manage deployments > แก้ไข > New version)
 *
 * วิธีใช้งาน:
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์
 * 2. สร้างชีตชื่อ "Devices" แล้ว import ไฟล์ devices.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 *    คอลัมน์: Feeder, DeviceID, Type, Rating, Description, Lat, Lon, Source, ParentID, MeterCount,
 *             VerifiedStatus, VerifiedDate, RatingConfidence, Unpositioned, Phase, CustomerImpact,
 *             SequenceVerified, MainChildId, SiblingPriority, ParentConfidence,
 *             TxType, TxTypeSource
 *    TxType = ชนิดหม้อแปลง: PEA (จำหน่าย) | PRIVATE (เฉพาะราย) | PUBLIC (สาธารณะ/ไฟทางหลวง) | TEMP (ชั่วคราว) | UNKNOWN
 *    TxTypeSource = ที่มาของค่า: auto (ระบบเดา) | office (เจ้าหน้าที่แก้) | field (ยืนยันหน้างาน)
 * 3. สร้างชีตชื่อ "Feeders" แล้ว import ไฟล์ feeders.csv เข้าไป (แถวแรกเป็นหัวตาราง)
 * 4. สร้างชีตชื่อ "FieldVerification" ใส่หัวตารางแถวแรกเป็น:
 *    Timestamp, Feeder, DeviceID, Status, CorrectedRating, CorrectedDesc, Note, PhotoUrl, Inspector,
 *    GpsLat, GpsLon, GpsDistanceMeters, GpsWithinTolerance, PhotoTankUrl
 *    (PhotoUrl = รูปต้นหม้อแปลง · PhotoTankUrl = รูปตัวถัง/เลข PEA — ถ้าชีตเดิมยังไม่มีคอลัมน์ PhotoTankUrl ระบบจะเพิ่มหัวตารางให้เอง)
 *    (ใช้เก็บประวัติการตรวจสอบภาคสนามทุกครั้ง แบบไม่ทับของเดิม — ถ้าไม่สร้างไว้ ระบบจะสร้างให้อัตโนมัติ)
 * 4.1 สร้างชีตชื่อ "ChangeLog" ใส่หัวตารางแถวแรกเป็น:
 *    Timestamp, Feeder, DeviceID, Action, Field, OldValue, NewValue, ChangedBy
 *    (บันทึกทุกการแก้ไข/ลบ/สร้างใหม่ ละเอียดถึงระดับฟิลด์ — ถ้าไม่สร้างไว้ ระบบจะสร้างให้อัตโนมัติเช่นกัน)
 * 4.2 สร้างชีตชื่อ "Admins" ใส่หัวตารางแถวแรกเป็น: Name, Password
 *    แล้วใส่ชื่อ+รหัสผ่านของผู้ดูแลระบบ (Admin) ทีละแถวด้านล่าง — ต้องสะกดชื่อตรงกับที่จะเลือก/พิมพ์ในหน้าเว็บทุกตัวอักษร
 *    ★ สำหรับ Patrol: เพิ่มคอลัมน์ C = Role (ตำแหน่ง) และ D = Org (สังกัด) ได้ ถ้าเว้นว่างระบบยังทำงานปกติ
 *    ⚠️ รหัสผ่านเก็บเป็นตัวอักษรธรรมดา ไม่ได้เข้ารหัส (ข้อจำกัดของระบบนี้ที่ไม่มีเซิร์ฟเวอร์กลาง) เหมาะกับกันคนพิมพ์ชื่อคนอื่นมั่ว
 *    ไม่ใช่ความปลอดภัยระดับสูง — อย่าตั้งรหัสผ่านซ้ำกับบัญชีสำคัญอื่นของผู้ใช้แต่ละคน
 * 4.3 สร้างชีตชื่อ "Members" ใส่หัวตารางแถวแรกเป็น: Name, Password
 *    แล้วใส่ชื่อ+รหัสผ่านของสมาชิกทั่วไปที่อนุญาตให้แก้ไข/ยืนยันข้อมูลได้ ทีละแถวด้านล่าง
 *    (คนที่ชื่อไม่อยู่ทั้งใน Admins และ Members จะดูผังได้ปกติ แต่แก้ไข/ยืนยันข้อมูลไม่ได้เลย)
 * 4.4 ชีตชื่อ "Pending" (คำขอสมัครสมาชิกที่รออนุมัติ) ระบบจะสร้างให้เองอัตโนมัติ ไม่ต้องสร้างเอง
 *    ⚠️ สำคัญมาก — ผู้ดูแลระบบ (Admin) คนแรกสุด ต้องเข้าไปพิมพ์ชื่อ+ตั้งรหัสผ่านของตัวเองลงชีต "Admins" เอง
 *    โดยตรงก่อนเสมอ (เพราะยังไม่มีใครเป็น Admin จะกดอนุมัติผ่านเว็บให้ไม่ได้) หลังจากนั้น Admin คนนี้จะอนุมัติ
 *    คนอื่นที่สมัครเข้ามาผ่านเมนูในเว็บได้เลย ไม่ต้องเข้าชีตอีก
 * 5. เปิด Extensions > Apps Script แล้ววางไฟล์นี้ทับ Code.gs ที่มีอยู่
 * 6. Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone (หรือ Anyone with the link)
 *    (ไม่ต้องบังคับให้ล็อกอิน Google — ตอนแก้ไข/ยืนยันข้อมูล หน้าเว็บจะให้เลือกหรือพิมพ์ชื่อจากรายชื่อ
 *    Admins/Members ที่อนุมัติไว้แทน ไม่ใช่การยืนยันตัวตนด้วยบัญชี Google จริง)
 * 7. คัดลอก URL ของ Web app ที่ได้ ไปใส่ในตัวแปร GAS_WEB_APP_URL ในไฟล์ index.html (หรือกดปุ่ม ⚙ ในหน้าเว็บ)
 *
 * รูปถ่ายจากการตรวจสอบภาคสนามจะถูกอัปโหลดไปเก็บใน Google Drive โฟลเดอร์หลักที่กำหนดไว้ตายตัว
 * (https://drive.google.com/drive/folders/1YTMaYPDgc8GJPx6Q8wtoIquJAeGwcIbN)
 * และแยกเก็บเป็นโฟลเดอร์ย่อยตามชื่อผู้ตรวจสอบแต่ละคนโดยอัตโนมัติ (ของใครของมัน ไม่ปนกัน)
 * ⚠️ บัญชีที่ deploy Apps Script นี้ต้องมีสิทธิ์เข้าถึง (แก้ไขได้) โฟลเดอร์ดังกล่าวก่อน ไม่งั้นจะอัปโหลดไม่สำเร็จ
 *
 * เมื่อแก้ไขข้อมูลอุปกรณ์ในอนาคต ให้แก้ไขที่ Google Sheet โดยตรง (ไม่ต้องแก้โค้ด)
 * หน้าเว็บจะดึงข้อมูลล่าสุดจาก Sheet ทุกครั้งที่เปิดหน้าเว็บ
 */

const SHEET_DEVICES = 'Devices';
const SHEET_FEEDERS = 'Feeders';
const SHEET_FIELD_LOG = 'FieldVerification';
const SHEET_CHANGE_LOG = 'ChangeLog';
const SHEET_ADMINS = 'Admins';
const SHEET_MEMBERS = 'Members';
const SHEET_PENDING = 'Pending';
const PHOTO_ROOT_FOLDER_ID = '1YTMaYPDgc8GJPx6Q8wtoIquJAeGwcIbN'; // โฟลเดอร์ Google Drive หลักที่กำหนดไว้สำหรับเก็บภาพตรวจสอบภาคสนามทั้งหมด

/** คืนชีตรายชื่อ (Admins/Members) สร้างให้อัตโนมัติพร้อมหัวตารางถ้ายังไม่มี (คอลัมน์: Name, Password) */
function getOrCreateNameSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Name', 'Password']);
  }
  return sheet;
}

/** อ่านรายชื่อ+รหัสผ่านทั้งหมดจากชีตที่กำหนด คืนเป็น array [{name, password}] */
function readMembersFull_(sheetName) {
  const sheet = getOrCreateNameSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    if (name) out.push({ name: name, password: String(values[i][1] || '') });
  }
  return out;
}
/** อ่านเฉพาะรายชื่อ (ไม่รวมรหัสผ่าน) — ใช้ตอนแสดงผลในหน้าเว็บ (autocomplete/รายการจัดการสมาชิก) เท่านั้น ห้ามส่งรหัสผ่านออกไปที่ฝั่งเว็บเด็ดขาด */
function readNameList_(sheetName) {
  return readMembersFull_(sheetName).map(m => m.name);
}

/**
 * ตรวจสิทธิ์จากชื่อ+รหัสผ่านที่กรอกมา คืนค่า 'admin' | 'member' | null
 * null = ไม่พบชื่อนี้เลย หรือ พบชื่อแต่รหัสผ่านไม่ตรง — ไม่แยกแจ้งว่าผิดจุดไหน เพื่อความปลอดภัย (กันเดาสุ่มว่าชื่อไหนมีอยู่จริง)
 */
function getUserRole_(name, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const pass = String(password || '');
  const admin = readMembersFull_(SHEET_ADMINS).find(m => m.name.toLowerCase() === lower);
  if (admin) return admin.password === pass ? 'admin' : null;
  const member = readMembersFull_(SHEET_MEMBERS).find(m => m.name.toLowerCase() === lower);
  if (member) return member.password === pass ? 'member' : null;
  return null;
}

/** คืนรายชื่อทั้งหมดที่แอดมินอนุมัติไว้ (Admins + Members) พร้อมระบุบทบาท — ชื่อเท่านั้น ไม่มีรหัสผ่านติดไปด้วยเด็ดขาด ให้หน้าเว็บเอาไปทำ dropdown/autocomplete เวลาเลือกชื่อผู้ใช้งาน */
function getMemberList_() {
  const admins = readNameList_(SHEET_ADMINS).map(n => ({ name: n, role: 'admin' }));
  const members = readNameList_(SHEET_MEMBERS).map(n => ({ name: n, role: 'member' }));
  return admins.concat(members);
}

/** เพิ่มชื่อ+รหัสผ่านใหม่ลงชีต Admins หรือ Members (ผ่านเมนูในเว็บ ไม่ต้องเข้า Google Sheet เอง) — เฉพาะ Admin เท่านั้นที่เพิ่มได้ */
function addMember_(name, role, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  if (role !== 'admin' && role !== 'member') return { ok: false, error: 'บทบาทไม่ถูกต้อง' };
  const passTrimmed = String(password || '').trim();
  if (!passTrimmed) return { ok: false, error: 'กรุณาตั้งรหัสผ่าน' };
  const lower = trimmed.toLowerCase();
  const existsInAdmins = readNameList_(SHEET_ADMINS).some(n => n.toLowerCase() === lower);
  const existsInMembers = readNameList_(SHEET_MEMBERS).some(n => n.toLowerCase() === lower);
  if (existsInAdmins || existsInMembers) {
    return { ok: false, error: 'มีชื่อนี้อยู่ในระบบแล้ว (เป็น ' + (existsInAdmins ? 'admin' : 'member') + ')' };
  }
  const sheetName = role === 'admin' ? SHEET_ADMINS : SHEET_MEMBERS;
  getOrCreateNameSheet_(sheetName).appendRow([trimmed, passTrimmed]);
  return { ok: true };
}

/** ลบชื่อออกจากชีต Admins หรือ Members — เฉพาะ Admin เท่านั้นที่ลบได้ */
function removeMember_(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const lower = trimmed.toLowerCase();
  let removed = false;
  [SHEET_ADMINS, SHEET_MEMBERS].forEach(function (sheetName) {
    const sheet = getOrCreateNameSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][0] || '').trim().toLowerCase() === lower) {
        sheet.deleteRow(i + 1);
        removed = true;
      }
    }
  });
  return removed ? { ok: true } : { ok: false, error: 'ไม่พบชื่อนี้ในระบบ' };
}

/** คืนชีต "Pending" (คำขอสมัครสมาชิกที่รออนุมัติ) สร้างให้อัตโนมัติพร้อมหัวตารางถ้ายังไม่มี */
function getOrCreatePendingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PENDING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENDING);
    sheet.appendRow(['Name', 'Password', 'RequestedRole', 'Timestamp']);
  }
  return sheet;
}

/** ใครก็ตามสมัครสมาชิกเองได้ — จะเข้าคิว "Pending" รอแอดมินอนุมัติก่อน ยังใช้แก้ไข/บันทึกข้อมูลไม่ได้จนกว่าจะอนุมัติ */
function registerRequest_(name, password) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const passTrimmed = String(password || '').trim();
  if (!passTrimmed) return { ok: false, error: 'กรุณาตั้งรหัสผ่าน' };
  const lower = trimmed.toLowerCase();
  if (readNameList_(SHEET_ADMINS).some(n => n.toLowerCase() === lower) ||
      readNameList_(SHEET_MEMBERS).some(n => n.toLowerCase() === lower)) {
    return { ok: false, error: 'มีชื่อนี้อยู่ในระบบแล้ว ลองเข้าสู่ระบบด้วยชื่อนี้แทนการสมัครใหม่' };
  }
  const pendingSheet = getOrCreatePendingSheet_();
  const pendingValues = pendingSheet.getDataRange().getValues();
  for (let i = 1; i < pendingValues.length; i++) {
    if (String(pendingValues[i][0] || '').trim().toLowerCase() === lower) {
      return { ok: false, error: 'มีคำขอสมัครด้วยชื่อนี้ค้างรออนุมัติอยู่แล้ว กรุณารอผู้ดูแลระบบอนุมัติ' };
    }
  }
  pendingSheet.appendRow([trimmed, passTrimmed, 'member', new Date()]);
  return { ok: true };
}

/** คืนรายชื่อคำขอสมัครที่รออนุมัติทั้งหมด (ไม่มีรหัสผ่านติดไปด้วย) — เฉพาะ Admin เท่านั้นที่ดูได้ */
function getPendingList_() {
  const sheet = getOrCreatePendingSheet_();
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    if (name) out.push({
      name: name,
      requestedRole: values[i][2] || 'member',
      timestamp: values[i][3] instanceof Date ? Utilities.formatDate(values[i][3], 'GMT+7', 'yyyy-MM-dd HH:mm') : String(values[i][3] || '')
    });
  }
  return out;
}

/** อนุมัติคำขอสมัคร — ย้ายชื่อ+รหัสผ่านจาก Pending ไปเป็น Admin หรือ Member จริง แล้วลบออกจาก Pending — เฉพาะ Admin เท่านั้นที่อนุมัติได้ */
function approvePending_(name, approvedRole, approvedApps) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  if (approvedRole !== 'admin' && approvedRole !== 'member') return { ok: false, error: 'บทบาทไม่ถูกต้อง' };
  const lower = trimmed.toLowerCase();
  const pendingSheet = getOrCreatePendingSheet_();
  const values = pendingSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === lower) {
      const password = String(values[i][1] || '');
      pendingSheet.deleteRow(i + 1);
      const targetSheet = approvedRole === 'admin' ? SHEET_ADMINS : SHEET_MEMBERS;
      const sheet = getOrCreateNameSheet_(targetSheet);
      sheet.appendRow([trimmed, password]);
      // กำหนดสิทธิ์รายโปรแกรมตั้งแต่ตอนอนุมัติ (ถ้าส่งมา) — ว่างไว้ = ใช้ได้ทุกโปรแกรม
      if (approvedRole !== 'admin' && Array.isArray(approvedApps)) {
        const valid = APP_LIST.map(function (a) { return a.code; });
        const apps = approvedApps.map(function (x) { return String(x).trim(); })
                                 .filter(function (x) { return valid.indexOf(x) >= 0; });
        if (String(sheet.getRange(1, APPS_COL).getValue() || '').trim() === '') {
          sheet.getRange(1, APPS_COL).setValue('Apps');
        }
        sheet.getRange(sheet.getLastRow(), APPS_COL).setValue(apps.length ? apps.join(',') : '-');
      }
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบคำขอสมัครชื่อนี้ (อาจถูกอนุมัติ/ปฏิเสธไปแล้ว)' };
}

/** ปฏิเสธคำขอสมัคร — ลบออกจาก Pending โดยไม่เพิ่มเป็นสมาชิก — เฉพาะ Admin เท่านั้นที่ปฏิเสธได้ */
function rejectPending_(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, error: 'กรุณาระบุชื่อ' };
  const lower = trimmed.toLowerCase();
  const pendingSheet = getOrCreatePendingSheet_();
  const values = pendingSheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0] || '').trim().toLowerCase() === lower) {
      pendingSheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบคำขอสมัครชื่อนี้' };
}

/**
 * บันทึกทุกการเปลี่ยนแปลงลง ChangeLog แบบละเอียด — 1 แถวต่อ 1 ฟิลด์ที่เปลี่ยน พร้อมค่าเดิม/ค่าใหม่/เวลา/ผู้แก้ไข
 * เพื่อให้ดึงออกมาเป็นรายงานส่งต่อให้แก้ไขข้อมูลต้นทาง (A0/GIS) ได้ครบถ้วน ตรวจสอบย้อนหลังได้เสมอ
 */
function logChange(action, feederId, deviceId, fieldChanges, changedBy) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_CHANGE_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_CHANGE_LOG);
    logSheet.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Action', 'Field', 'OldValue', 'NewValue', 'ChangedBy']);
  }
  const who = (changedBy || '').trim() || '(ไม่ระบุชื่อ)';
  const now = new Date();
  if (!fieldChanges || !fieldChanges.length) {
    logSheet.appendRow([now, feederId, deviceId, action, '', '', '', who]);
  } else {
    fieldChanges.forEach(function (ch) {
      logSheet.appendRow([now, feederId, deviceId, action, ch.field, ch.oldValue, ch.newValue, who]);
    });
  }
}

/** เปรียบเทียบอุปกรณ์เก่ากับใหม่ทีละฟิลด์ คืนเฉพาะฟิลด์ที่ค่าเปลี่ยนจริง (ใช้ก่อนบันทึกทับ เพื่อรู้ว่าเปลี่ยนอะไรบ้าง) */
function diffDeviceFields(oldRow, newDev) {
  const fields = [
    { idx: 2, key: 'type', label: 'ประเภท' },
    { idx: 3, key: 'rating', label: 'ขนาด' },
    { idx: 4, key: 'desc', label: 'จุดติดตั้ง/คำอธิบาย' },
    { idx: 8, key: 'parentId', label: 'ต่อจากอุปกรณ์ (ParentID)' },
    { idx: 14, key: 'phase', label: 'เฟส' },
    { idx: 20, key: 'txType', label: 'ชนิดหม้อแปลง' },
  ];
  const changes = [];
  fields.forEach(function (f) {
    const oldVal = oldRow ? String(oldRow[f.idx] || '') : '';
    const newVal = String(newDev[f.key] || '');
    if (oldVal !== newVal) changes.push({ field: f.label, oldValue: oldVal, newValue: newVal });
  });
  return changes;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getMemberList') {
    return jsonOut({ ok: true, members: getMemberList_() });
  }
  if (e && e.parameter && e.parameter.action === 'getFieldHistory') {
    return jsonOut(getFieldHistory_(e.parameter.deviceId, parseInt(e.parameter.limit, 10) || 5));
  }
  const data = buildData();
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** เติมหัวคอลัมน์ใหม่ให้ชีต Devices ถ้ายังไม่มี (ชีตเดิมมี 20 คอลัมน์) — เรียกก่อนเขียนแถว */
function ensureDeviceHeaders_(sheet) {
  const names = { 21: 'TxType', 22: 'TxTypeSource', 23: 'PoleTag' };
  Object.keys(names).forEach(function (col) {
    const c = parseInt(col, 10);
    if (String(sheet.getRange(1, c).getValue() || '').trim() === '') sheet.getRange(1, c).setValue(names[col]);
  });
}

function buildData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const feederSheet = ss.getSheetByName(SHEET_FEEDERS);
  const feederRows = feederSheet.getDataRange().getValues();
  const feederHeader = feederRows.shift(); // FeederID, Name, Color, TieTo

  const feeders = feederRows
    .filter(r => r[0]) // skip blank rows
    .map(r => ({
      id: String(r[0]).trim(),
      name: String(r[1] || '').trim(),
      color: String(r[2] || '#888888').trim(),
      tieTo: String(r[3] || '').trim(),
      devices: []
    }));

  const feederById = {};
  feeders.forEach(f => feederById[f.id] = f);

  const deviceSheet = ss.getSheetByName(SHEET_DEVICES);
  const deviceRows = deviceSheet.getDataRange().getValues();
  deviceRows.shift(); // Feeder, DeviceID, Type, Rating, Description, Lat, Lon, Source, ParentID, MeterCount, VerifiedStatus, VerifiedDate

  deviceRows.forEach(r => {
    const feederId = String(r[0] || '').trim();
    const deviceId = String(r[1] || '').trim();
    if (!feederId || !deviceId) return;
    if (!feederById[feederId]) return; // skip rows with unknown feeder id
    const dev = {
      id: deviceId,
      type: String(r[2] || '').trim(),
      rating: String(r[3] || '').trim(),
      desc: String(r[4] || '').trim()
    };
    const lat = parseFloat(r[5]), lon = parseFloat(r[6]);
    if (!isNaN(lat) && !isNaN(lon)) { dev.lat = lat; dev.lon = lon; }
    dev.source = String(r[7] || 'manual').trim() || 'manual';
    const parentId = String(r[8] || '').trim();
    if (parentId) dev.parentId = parentId;
    const meterCount = parseInt(r[9], 10);
    if (!isNaN(meterCount)) dev.meterCount = meterCount;
    const verifiedStatus = String(r[10] || '').trim();
    const verifiedDate = String(r[11] || '').trim();
    if (verifiedStatus) dev.verified = { status: verifiedStatus, date: verifiedDate };
    const ratingConfidence = String(r[12] || '').trim();
    if (ratingConfidence) dev.ratingConfidence = ratingConfidence;
    const unpositioned = String(r[13] || '').trim();
    if (unpositioned && unpositioned.toUpperCase() === 'TRUE') dev.unpositioned = true;
    const phase = String(r[14] || '').trim();
    if (phase) dev.phase = phase;
    const customerImpact = parseInt(r[15], 10);
    if (!isNaN(customerImpact)) dev.customerImpact = customerImpact;
    const sequenceVerified = String(r[16] || '').trim();
    if (sequenceVerified && sequenceVerified.toUpperCase() === 'TRUE') dev.sequenceVerified = true;
    const mainChildId = String(r[17] || '').trim();
    if (mainChildId) dev.mainChildId = mainChildId;
    const siblingPriority = parseFloat(r[18]);
    if (!isNaN(siblingPriority)) dev.siblingPriority = siblingPriority;
    const txType = String(r[20] || '').trim().toUpperCase();
    if (txType) dev.txType = txType;
    const txTypeSource = String(r[21] || '').trim();
    if (txTypeSource) dev.txTypeSource = txTypeSource;
    const parentConfidence = String(r[19] || '').trim();
    if (parentConfidence) dev.parentConfidence = parentConfidence;
    const poleTag = String(r[22] || '').trim();                 // คอลัมน์ W = เลขเสาที่หม้อแปลงติดตั้ง
    if (poleTag) dev.poleTag = poleTag;
    // คอลัมน์ X,Y = ผลวัดโหลดครั้งล่าสุด — ว่างทั้งคู่คือยังไม่เคยวัด หน้าเว็บจะไม่แสดงสัญลักษณ์
    const lastLoadAt = r[23];
    const lastLoadPct = parseFloat(r[24]);
    const lastLoadKva = parseFloat(r[25]);
    if (lastLoadAt) {
      dev.lastLoad = {
        at: lastLoadAt instanceof Date
          ? Utilities.formatDate(lastLoadAt, 'GMT+7', 'yyyy-MM-dd HH:mm')
          : String(lastLoadAt).trim()
      };
      if (!isNaN(lastLoadPct)) dev.lastLoad.pct = lastLoadPct;
      if (!isNaN(lastLoadKva)) dev.lastLoad.kva = lastLoadKva;
      const lastLoadVer = String(r[26] || '').trim();
      if (lastLoadVer) dev.lastLoad.verdict = lastLoadVer;
    }
    feederById[feederId].devices.push(dev);
  });

  return {
    substation: {
      id: 'ALA',
      name: 'สถานีไฟฟ้าอ่าวลึก',
      region: 'กฟต.2',
      branch: 'กฟส.อ่าวลึก',
      sourceDrawing: 'ข้อมูลสดจาก Google Sheet'
    },
    feeders: feeders
  };
}

/**
 * รับการแก้ไข/เพิ่ม/ลบ อุปกรณ์ และผลตรวจสอบภาคสนาม จากหน้าเว็บ
 * body ที่ส่งมาเป็น JSON รูปแบบ:
 *   { action: 'upsert', feeder: 'ALA05', device: {id, type, rating, desc, ...} }
 *   { action: 'delete', feeder: 'ALA05', id: 'ALA05WF-999' }
 *   { action: 'fieldVerify', feeder, deviceId, verification: {status, correctedRating,
 *       correctedDesc, note, inspector, date}, photos: [{kind:'pole'|'tank', base64, mimeType}],
 *       photoBase64, photoMimeType (แบบเดิม รูปเดียว — ยังรองรับ), updatedDevice }
 *   { action: 'patrol...' } → ส่งต่อให้ handlePatrolAction_ ที่อยู่ท้ายไฟล์
 *
 * หมายเหตุ: ส่งมาด้วย Content-Type: text/plain เพื่อเลี่ยงปัญหา CORS preflight
 * ของ Apps Script (เบราว์เซอร์จะไม่ยิง OPTIONS ก่อน) โค้ดฝั่งนี้ยัง parse เป็น JSON ตามปกติ
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'getMemberList') {
      return jsonOut({ ok: true, members: getMemberList_() });
    }
    if (body.action === 'register') {
      // สมัครสมาชิกเอง — ไม่ต้องมีสิทธิ์อะไรมาก่อน (ยังไม่ใช่สมาชิก) เข้าคิว Pending รอแอดมินอนุมัติ
      const result = registerRequest_(body.newName, body.newPassword);
      if (result.ok) logChange('สมัครสมาชิก (รออนุมัติ)', '', body.newName, [], body.newName);
      return jsonOut(result);
    }

    // ตรวจสิทธิ์จากชื่อ+รหัสผ่านที่กรอกมา (ต้องอยู่ในรายชื่อ Admins หรือ Members ที่แอดมินอนุมัติไว้ล่วงหน้าเท่านั้น และรหัสผ่านต้องตรงกัน)
    const changedByName = (body.changedBy || '').trim();
    const changedByPassword = body.changedByPassword || '';
    const requesterRole = getUserRole_(changedByName, changedByPassword);
    if (body.action === 'whoAmI') {
      return jsonOut({ ok: true, name: changedByName, role: requesterRole });
    }
    if (!requesterRole) {
      return jsonOut({ ok: false, error: 'unauthorized', name: changedByName,
        message: 'ชื่อ "' + (changedByName || '(ยังไม่ได้เลือกชื่อ)') + '" หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง หรือติดต่อผู้ดูแลระบบ' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
    const values = sheet.getDataRange().getValues();

    // แก้ไข/ลบรูปถ่ายของผลสำรวจที่บันทึกไว้แล้ว — ระบุแถวในชีต FieldVerification + ช่องรูป (pole/tank)
    if (body.action === 'photoEdit') {
      const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FIELD_LOG);
      if (!logSheet) return jsonOut({ ok: false, error: 'ไม่พบชีต ' + SHEET_FIELD_LOG });
      const rowNo = parseInt(body.row, 10);
      const kind = body.kind === 'tank' ? 'tank' : 'pole';
      const col = kind === 'tank' ? 14 : 8;   // PhotoTankUrl / PhotoUrl
      if (!rowNo || rowNo < 2 || rowNo > logSheet.getLastRow()) return jsonOut({ ok: false, error: 'ไม่พบแถวผลสำรวจที่ระบุ' });
      const rowVals = logSheet.getRange(rowNo, 1, 1, 14).getValues()[0];
      if (String(rowVals[2] || '').trim() !== String(body.deviceId || '').trim()) {
        return jsonOut({ ok: false, error: 'แถวที่ระบุไม่ตรงกับหม้อแปลงนี้ — กรุณารีเฟรชแล้วลองใหม่' });
      }
      const oldUrl = String(rowVals[col - 1] || '');
      // ย้ายไฟล์เดิมลงถังขยะของ Drive (กู้คืนได้ 30 วัน) — ไม่ลบถาวร
      let trashed = false;
      const m = oldUrl.match(/\/d\/([\w-]{20,})/) || oldUrl.match(/[?&]id=([\w-]{20,})/);
      if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); trashed = true; } catch (err) { trashed = false; } }
      let newUrl = '';
      if (body.mode === 'replace') {
        if (!body.base64) return jsonOut({ ok: false, error: 'ไม่มีไฟล์รูปใหม่' });
        try {
          const folder = getOrCreateInspectorFolder(changedByName);
          const bytes = Utilities.base64Decode(body.base64);
          const filename = String(body.deviceId) + '_' + kind + '_' + new Date().getTime() + '.jpg';
          const file = folder.createFile(Utilities.newBlob(bytes, body.mimeType || 'image/jpeg', filename));
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          newUrl = file.getUrl();
        } catch (err) {
          return jsonOut({ ok: false, error: 'อัปโหลดรูปใหม่ไม่สำเร็จ: ' + String(err) });
        }
      }
      logSheet.getRange(rowNo, col).setValue(newUrl);
      logChange(body.mode === 'replace' ? 'เปลี่ยนรูปผลสำรวจ' : 'ลบรูปผลสำรวจ', String(rowVals[1] || ''), String(body.deviceId || ''),
        [{ field: kind === 'tank' ? 'รูปตัวถัง/เลข PEA' : 'รูปต้นหม้อแปลง', oldValue: oldUrl, newValue: newUrl }], changedByName);
      return jsonOut({ ok: true, url: newUrl, oldTrashed: trashed });
    }

    // บันทึกอุปกรณ์หลายเครื่องในคำสั่งเดียว — อ่านชีตครั้งเดียว เขียนครั้งเดียว เร็วกว่ายิงทีละเครื่องมาก
    if (body.action === 'upsertBatch') {
      const items = body.items || [];
      if (!items.length) return jsonOut({ ok: false, error: 'ไม่มีรายการ' });
      ensureDeviceHeaders_(sheet);
      const rowById = {};
      for (let i = 1; i < values.length; i++) rowById[String(values[i][1]).trim()] = i;
      const toRow = function (feederId, dev) {
        return [feederId, dev.id, dev.type || '', dev.rating || '', dev.desc || '',
                dev.lat || '', dev.lon || '', dev.source || 'manual',
                dev.parentId || '', dev.meterCount || '',
                (dev.verified && dev.verified.status) || '', (dev.verified && dev.verified.date) || '',
                dev.ratingConfidence || '', dev.unpositioned ? 'TRUE' : '',
                dev.phase || '', dev.customerImpact != null ? dev.customerImpact : '',
                dev.sequenceVerified ? 'TRUE' : '',
                dev.mainChildId || '', dev.siblingPriority != null ? dev.siblingPriority : '',
                dev.parentConfidence || '', dev.txType || '', dev.txTypeSource || ''];
      };
      const now = new Date();
      const logRows = [];
      const appendRows = [];
      const okIds = [], failIds = [];
      items.forEach(function (it) {
        const dev = it.device, feederId = it.feeder;
        if (!dev || !dev.id || !feederId) { failIds.push((dev && dev.id) || '?'); return; }
        const idx = rowById[String(dev.id).trim()];
        const isNew = idx === undefined;
        const changes = isNew ? [] : diffDeviceFields(values[idx], dev);
        const rowData = toRow(feederId, dev);
        if (isNew) {
          appendRows.push(rowData);
          logRows.push([now, feederId, dev.id, 'สร้างใหม่', '', '', '', changedByName]);
        } else {
          values[idx] = rowData;                    // อัปเดตในหน่วยความจำก่อน เขียนทีเดียวตอนท้าย
          changes.forEach(function (ch) {
            logRows.push([now, feederId, dev.id, it.reason ? 'แก้ไข: ' + it.reason : 'แก้ไข', ch.field, ch.oldValue, ch.newValue, changedByName]);
          });
        }
        okIds.push(dev.id);
      });
      // เขียนแถวเดิมทั้งชีตครั้งเดียว (เฉพาะช่วงที่มีข้อมูล)
      if (values.length > 1) sheet.getRange(2, 1, values.length - 1, 22).setValues(values.slice(1).map(function (r) {
        const row = r.slice(0, 22);
        while (row.length < 22) row.push('');
        return row;
      }));
      if (appendRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, 22).setValues(appendRows);
      if (logRows.length) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let logSheet = ss.getSheetByName(SHEET_CHANGE_LOG);
        if (!logSheet) {
          logSheet = ss.insertSheet(SHEET_CHANGE_LOG);
          logSheet.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Action', 'Field', 'OldValue', 'NewValue', 'ChangedBy']);
        }
        logSheet.getRange(logSheet.getLastRow() + 1, 1, logRows.length, 8).setValues(logRows);
      }
      return jsonOut({ ok: true, saved: okIds.length, failed: failIds });
    }

    if (body.action === 'upsert') {
      const dev = body.device;
      const feederId = body.feeder;
      const changedBy = changedByName;
      if (!dev || !dev.id || !feederId) return jsonOut({ ok: false, error: 'missing feeder/device' });

      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === dev.id) { rowIndex = i; break; }
      }
      const isNew = rowIndex < 0;
      const oldRow = isNew ? null : values[rowIndex];
      const fieldChanges = diffDeviceFields(oldRow, dev);
      const rowData = [feederId, dev.id, dev.type || '', dev.rating || '', dev.desc || '',
                        dev.lat || '', dev.lon || '', dev.source || 'manual',
                        dev.parentId || '', dev.meterCount || '',
                        (dev.verified && dev.verified.status) || '', (dev.verified && dev.verified.date) || '',
                        dev.ratingConfidence || '', dev.unpositioned ? 'TRUE' : '',
                        dev.phase || '', dev.customerImpact != null ? dev.customerImpact : '',
                        dev.sequenceVerified ? 'TRUE' : '',
                        dev.mainChildId || '', dev.siblingPriority != null ? dev.siblingPriority : '',
                        dev.parentConfidence || '',
                        dev.txType || '', dev.txTypeSource || ''];
      ensureDeviceHeaders_(sheet);
      if (rowIndex >= 0) {
        sheet.getRange(rowIndex + 1, 1, 1, 22).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      // บันทึก log เฉพาะตอนมีการแก้ไขจริง (สร้างใหม่ หรือมีฟิลด์เปลี่ยนแปลง) — ไม่บันทึกซ้ำถ้าบันทึกค่าเดิมทับค่าเดิม
      if (isNew) {
        logChange('สร้างใหม่', feederId, dev.id, [], changedBy);
      } else if (fieldChanges.length) {
        logChange('แก้ไข', feederId, dev.id, fieldChanges, changedBy);
      }
      return jsonOut({ ok: true });

    } else if (body.action === 'delete') {
      const devId = body.id;
      const changedBy = changedByName;
      if (!devId) return jsonOut({ ok: false, error: 'missing device id' });
      let feederOfDeleted = '';
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][1]).trim() === devId) {
          feederOfDeleted = values[i][0];
          sheet.deleteRow(i + 1);
          break;
        }
      }
      logChange('ลบ', feederOfDeleted, devId, [], changedBy);
      return jsonOut({ ok: true });

    } else if (body.action === 'bulkSetVerified') {
      // ตั้งค่ายืนยันลำดับ (SequenceVerified คอลัมน์ที่ 17) ให้อุปกรณ์หลายตัวพร้อมกันในรอบเดียว
      // เร็วกว่าและเชื่อถือได้กว่าการยิงทีละอุปกรณ์ทีละคำขอ (ซึ่งถ้าพลาดกลางทางจะไม่รู้ตัว)
      const deviceIds = body.deviceIds;
      const verified = !!body.verified;
      if (!Array.isArray(deviceIds) || !deviceIds.length) return jsonOut({ ok: false, error: 'missing deviceIds' });
      const idSet = {};
      deviceIds.forEach(function (id) { idSet[String(id).trim()] = true; });
      let updatedCount = 0;
      const notFound = [];
      const stillIdSet = Object.assign({}, idSet);
      for (let i = 1; i < values.length; i++) {
        const rowId = String(values[i][1]).trim();
        if (idSet[rowId]) {
          sheet.getRange(i + 1, 17).setValue(verified ? 'TRUE' : ''); // คอลัมน์ 17 = SequenceVerified
          updatedCount++;
          delete stillIdSet[rowId];
        }
      }
      Object.keys(stillIdSet).forEach(function (id) { notFound.push(id); });
      logChange(verified ? 'ยืนยันลำดับ (ทั้งชุด)' : 'ล้างยืนยันลำดับ (ทั้งชุด)', body.feeder || '', updatedCount + ' รายการ',
        [{ field: 'SequenceVerified', oldValue: '', newValue: verified ? 'TRUE' : 'FALSE' }], changedByName);
      return jsonOut({ ok: true, updatedCount: updatedCount, notFound: notFound });

    } else if (body.action === 'fieldVerify') {
      return handleFieldVerify(body, sheet, values, changedByName);

    } else if (body.action === 'getChangeLog') {
      return handleGetChangeLog(requesterRole);

    } else if (body.action === 'addMember') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เพิ่มรายชื่อได้' });
      const result = addMember_(body.newName, body.newRole, body.newPassword);
      if (result.ok) logChange('เพิ่มสมาชิก', '', body.newName, [{ field: 'บทบาท', oldValue: '', newValue: body.newRole }], changedByName);
      return jsonOut(result);

    } else if (body.action === 'removeMember') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ลบรายชื่อได้' });
      const result = removeMember_(body.targetName);
      if (result.ok) logChange('ลบสมาชิก', '', body.targetName, [], changedByName);
      return jsonOut(result);

    } else if (body.action === 'getPendingList') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูคำขอสมัครได้' });
      return jsonOut({ ok: true, pending: getPendingList_() });

    } else if (body.action === 'approvePending') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่อนุมัติได้' });
      const result = approvePending_(body.targetName, body.approvedRole, body.approvedApps);
      if (result.ok) logChange('อนุมัติสมาชิก', '', body.targetName, [{ field: 'บทบาท', oldValue: '', newValue: body.approvedRole }], changedByName);
      return jsonOut(result);

    } else if (body.action === 'rejectPending') {
      if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ปฏิเสธได้' });
      const result = rejectPending_(body.targetName);
      if (result.ok) logChange('ปฏิเสธคำขอสมัคร', '', body.targetName, [], changedByName);
      return jsonOut(result);

    }

    // ★ เพิ่มใหม่ — คำสั่งของ Patrol ระบบจำหน่าย (ทุก action ที่ขึ้นต้นด้วย "patrol")
    //   ถ้าไม่ใช่คำสั่งของ Patrol จะคืน null แล้วตกไปบรรทัด unknown action ตามเดิม
    const patrolRes = handlePatrolAction_(body, requesterRole, changedByName);
    if (patrolRes) return patrolRes;

    // ★ เพิ่มใหม่ — คำสั่งการวัดโหลดหม้อแปลง (ทุก action ที่ขึ้นต้นด้วย "txLoad")
    const txLoadRes = handleTxLoadAction_(body, requesterRole, changedByName);
    if (txLoadRes) return txLoadRes;

    return jsonOut({ ok: false, error: 'unknown action: ' + body.action });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** ดึงประวัติการเปลี่ยนแปลงทั้งหมด (เฉพาะ Admin เท่านั้นที่ดึงได้ — ตรวจจากอีเมล Google จริงของผู้เรียก) */
function handleGetChangeLog(requesterRole) {
  if (requesterRole !== 'admin') {
    return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ดูประวัติการเปลี่ยนแปลงได้' });
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHANGE_LOG);
  if (!sheet) return jsonOut({ ok: true, rows: [] });
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const limit = 1000;
  const dataRows = values.slice(1);
  const recent = dataRows.slice(Math.max(0, dataRows.length - limit)).reverse(); // ล่าสุดขึ้นก่อน
  const rows = recent.map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) {
      obj[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'GMT+7', 'yyyy-MM-dd HH:mm:ss') : r[i];
    });
    return obj;
  });
  return jsonOut({ ok: true, rows: rows });
}

function handleFieldVerify(body, deviceSheet, deviceValues, changedByName) {
  const feederId = body.feeder;
  const deviceId = body.deviceId;
  const v = body.verification || {};
  if (!feederId || !deviceId) return jsonOut({ ok: false, error: 'missing feeder/deviceId' });
  // ใช้ชื่อที่เลือกจากรายชื่อที่แอดมินอนุมัติไว้เป็นตัวระบุตัวตนหลัก
  const inspectorDisplay = changedByName;

  // 1) อัปโหลดรูปขึ้น Drive — รองรับหลายรูป (photos: รูปต้นหม้อแปลง 'pole', รูปตัวถัง/เลข PEA 'tank')
  //    และแบบเดิมรูปเดียว (photoBase64) — ถ้ารูปไหนอัปโหลดไม่ได้ ไม่ทำให้การบันทึกผลตรวจทั้งหมดล้มเหลว
  const photoUrls = {};
  const uploadOne = function (base64, mime, kind) {
    try {
      const folder = getOrCreateInspectorFolder(changedByName);
      const bytes = Utilities.base64Decode(base64);
      const filename = deviceId + '_' + (kind || 'photo') + '_' + new Date().getTime() + '.jpg';
      const file = folder.createFile(Utilities.newBlob(bytes, mime || 'image/jpeg', filename));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return file.getUrl();
    } catch (photoErr) {
      return 'UPLOAD_FAILED: ' + String(photoErr);
    }
  };
  if (Array.isArray(body.photos) && body.photos.length) {
    body.photos.slice(0, 4).forEach(function (p) {
      if (p && p.base64) photoUrls[p.kind || 'photo'] = uploadOne(p.base64, p.mimeType, p.kind);
    });
  } else if (body.photoBase64) {
    photoUrls.pole = uploadOne(body.photoBase64, body.photoMimeType, 'pole');
  }
  const photoUrl = photoUrls.pole || photoUrls.photo || '';   // คอลัมน์ PhotoUrl เดิม = รูปต้นหม้อแปลง
  const photoTankUrl = photoUrls.tank || '';                   // คอลัมน์ใหม่ PhotoTankUrl = รูปตัวถัง/เลข PEA

  // 2) append to the FieldVerification audit-log sheet (never overwritten — full history)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_FIELD_LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_FIELD_LOG);
    logSheet.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Status', 'CorrectedRating',
                         'CorrectedDesc', 'Note', 'PhotoUrl', 'Inspector',
                         'GpsLat', 'GpsLon', 'GpsDistanceMeters', 'GpsWithinTolerance', 'PhotoTankUrl']);
  } else if (String(logSheet.getRange(1, 14).getValue() || '').trim() === '') {
    logSheet.getRange(1, 14).setValue('PhotoTankUrl'); // ชีตเดิมที่สร้างไว้ก่อน — เพิ่มหัวคอลัมน์ใหม่ให้
  }
  // คอลัมน์ข้อมูลเสา (O P Q R) — เลขเสาที่เลือก พิกัดเสาจาก GIS และระยะห่างจาก GPS มือถือ
  [[15, 'PoleTag'], [16, 'PoleLat'], [17, 'PoleLon'], [18, 'PoleGpsDistanceMeters'], [19, 'Snapshot']].forEach(function (h) {
    if (String(logSheet.getRange(1, h[0]).getValue() || '').trim() === '') logSheet.getRange(1, h[0]).setValue(h[1]);
  });
  logSheet.appendRow([new Date(), feederId, deviceId, v.status || '', v.correctedRating || '',
                       v.correctedDesc || '', v.note || '', photoUrl, inspectorDisplay,
                       v.gpsLat != null ? v.gpsLat : '', v.gpsLon != null ? v.gpsLon : '',
                       v.gpsDistanceMeters != null ? Math.round(v.gpsDistanceMeters * 10) / 10 : '',
                       v.gpsWithinTolerance != null ? (v.gpsWithinTolerance ? 'TRUE' : 'FALSE') : '',
                       photoTankUrl,
                       v.poleTag || '', v.poleLat != null ? v.poleLat : '', v.poleLon != null ? v.poleLon : '',
                       v.poleGpsDistance != null ? Math.round(v.poleGpsDistance * 10) / 10 : '',
                       String(v.snapshot || '')]);   // ค่าของหม้อแปลงหลังบันทึก — ใช้เทียบการเปลี่ยนแปลงครั้งถัดไป
  logChange('ตรวจสอบภาคสนาม', feederId, deviceId,
    [{ field: 'ผลตรวจสอบ', oldValue: '', newValue: (v.status === 'mismatch' ? 'ไม่ตรง - แก้ไข' : 'ตรงกับข้อมูล') }],
    changedByName);

  // 3) update the Devices row itself: verification badge always, corrected values if mismatch, GPS if newly captured
  let rowIndex = -1;
  for (let i = 1; i < deviceValues.length; i++) {
    if (String(deviceValues[i][1]).trim() === deviceId) { rowIndex = i; break; }
  }
  if (rowIndex >= 0) {
    if (v.status === 'mismatch') {
      if (v.correctedRating) deviceSheet.getRange(rowIndex + 1, 4).setValue(v.correctedRating);
      if (v.correctedDesc) deviceSheet.getRange(rowIndex + 1, 5).setValue(v.correctedDesc);
      deviceSheet.getRange(rowIndex + 1, 8).setValue('field-verified'); // Source
    }
    const ud = body.updatedDevice;
    if (ud && ud.lat != null && ud.lon != null) {
      deviceSheet.getRange(rowIndex + 1, 6).setValue(ud.lat); // Lat
      deviceSheet.getRange(rowIndex + 1, 7).setValue(ud.lon); // Lon
    }
    deviceSheet.getRange(rowIndex + 1, 11).setValue(v.status || '');       // VerifiedStatus
    deviceSheet.getRange(rowIndex + 1, 12).setValue(v.date || '');        // VerifiedDate
    if (v.poleTag) {
      ensureDeviceHeaders_(deviceSheet);
      const oldPole = String(deviceSheet.getRange(rowIndex + 1, 23).getValue() || '');
      deviceSheet.getRange(rowIndex + 1, 23).setValue(v.poleTag);           // PoleTag
      if (oldPole !== v.poleTag) {
        logChange('ระบุเสาที่ติดตั้ง', feederId, deviceId,
          [{ field: 'เลขเสา', oldValue: oldPole, newValue: v.poleTag }], changedByName);
      }
    }
  }

  return jsonOut({ ok: true, photoUrl: photoUrl, photoUrls: photoUrls });
}

/**
 * ประวัติการสำรวจภาคสนามของอุปกรณ์ 1 ตัว (ล่าสุดขึ้นก่อน) — ใช้แสดงผลสำรวจ/รูปถ่ายเดิมเมื่อเปิดดูอุปกรณ์อีกครั้ง
 * อ่านอย่างเดียว ไม่แก้ข้อมูล · ไม่ส่งรหัสผ่านหรือข้อมูลบัญชีใดๆ ออกไป
 */
function getFieldHistory_(deviceId, limit) {
  const id = String(deviceId || '').trim();
  if (!id) return { ok: false, error: 'missing deviceId' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FIELD_LOG);
  if (!sheet) return { ok: true, deviceId: id, records: [] };
  const values = sheet.getDataRange().getValues();
  const fmt = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd HH:mm') : String(v || ''); };
  const records = [];
  for (let i = values.length - 1; i >= 1 && records.length < Math.min(limit || 5, 20); i--) {
    const r = values[i];
    if (String(r[2] || '').trim() !== id) continue;
    records.push({
      row: i + 1,   // เลขแถวจริงในชีต — ใช้อ้างอิงตอนแก้/ลบรูป
      time: fmt(r[0]), feeder: String(r[1] || ''), status: String(r[3] || ''),
      correctedRating: String(r[4] || ''), correctedDesc: String(r[5] || ''), note: String(r[6] || ''),
      photoPoleUrl: String(r[7] || ''), inspector: String(r[8] || ''),
      gpsDistanceMeters: r[11] === '' ? null : r[11],
      photoTankUrl: String(r[13] || ''),
      poleTag: String(r[14] || ''),
      snapshot: String(r[18] || '')
    });
  }
  return { ok: true, deviceId: id, records: records };
}

/**
 * คืนโฟลเดอร์ย่อยของผู้ตรวจสอบแต่ละคน (แยกตามชื่อที่เลือกจากรายชื่อที่อนุมัติไว้) ภายในโฟลเดอร์หลักที่กำหนดไว้ (PHOTO_ROOT_FOLDER_ID)
 * เพื่อให้ภาพของแต่ละคนแยกเก็บเป็นสัดส่วนของตัวเอง ไม่ปนกัน
 */
function getOrCreateInspectorFolder(inspectorName) {
  const rootFolder = DriveApp.getFolderById(PHOTO_ROOT_FOLDER_ID);
  const name = (inspectorName || '').trim() || 'ไม่ระบุชื่อผู้ตรวจสอบ';
  const it = rootFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return rootFolder.createFolder(name);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ฟังก์ชันช่วยตรวจสอบข้อมูล — เรียกใช้จากใน Apps Script editor (Run) ได้เลย
 * เพื่อดูผลลัพธ์ JSON ใน Logger ก่อนนำไป deploy จริง
 */
function testBuildData() {
  Logger.log(JSON.stringify(buildData(), null, 2));
}


/* ===========================================================================
 *  Patrol ระบบจำหน่าย — งานป้องกันไฟดับ  (เฟส 1)
 *  ส่วนที่เพิ่มใหม่ ไม่กระทบโค้ดเดิมด้านบนเลย
 *
 *  หลังวางไฟล์นี้แล้ว ให้ Run ฟังก์ชัน patrolSetup 1 ครั้ง เพื่อสร้างชีต 4 แท็บ
 *    PatrolFinding · PatrolJob · PatrolPhoto · PatrolType
 *  แล้ว Deploy ใหม่ (Manage deployments > แก้ไข > New version)
 *
 *  ตำแหน่ง/สังกัดของผู้ใช้ — เพิ่มคอลัมน์ C และ D ในชีต Admins และ Members
 *    C = Role (ตำแหน่ง เช่น ผู้จัดการ / หัวหน้าแผนก / ช่าง)
 *    D = Org  (สังกัด เช่น กฟส.อ่าวลึก)
 *    ถ้าเว้นว่างไว้ ระบบยังทำงานได้ปกติ แค่ไม่มีข้อมูลสองช่องนี้ติดไปกับรายการที่บันทึก
 * =========================================================================== */

const SHEET_PATROL_FINDING = 'PatrolFinding';
const SHEET_PATROL_JOB = 'PatrolJob';
const SHEET_PATROL_PHOTO = 'PatrolPhoto';
const SHEET_PATROL_TYPE = 'PatrolType';
const PATROL_PHOTO_FOLDER = 'Patrol';   // โฟลเดอร์ย่อยใน PHOTO_ROOT_FOLDER_ID

const PATROL_FINDING_HEADERS = ['FindingID', 'CreatedAt', 'CreatedBy', 'CreatorRole', 'CreatorOrg',
  'AnchorType', 'AnchorRef', 'Lat', 'Lon', 'GpsAccuracy', 'FeederID', 'ProblemType', 'Severity',
  'Detail', 'Source', 'Status', 'JobID', 'ClosedAt', 'ClosedBy', 'CloseReason',
  'NearPlace', 'Address', 'Moo', 'Landmark',
  'OrderNo', 'OrderDate', 'FixedDate', 'FixedBy', 'FixedDetail'];
// คอลัมน์ที่ตั้ง (U V W X) — NearPlace/Address ระบบใส่ให้ · Moo/Landmark ช่างกรอกเอง
const COL_NEARPLACE = 21, COL_ADDRESS = 22, COL_MOO = 23, COL_LANDMARK = 24;
// คอลัมน์ปิดงาน (Y Z AA AB AC) — ใบสั่งงานเป็นตัวเลขล้วน · วันที่ดำเนินการจริงแยกจากวันที่กดปิดในระบบ
const COL_ORDERNO = 25, COL_ORDERDATE = 26, COL_FIXEDDATE = 27, COL_FIXEDBY = 28, COL_FIXEDDETAIL = 29;
const STATUS_CLOSED = 'ปิด', STATUS_NOTISSUE = 'ปิด (ไม่ใช่ปัญหา)';

const PATROL_JOB_HEADERS = ['JobID', 'JobName', 'JobType', 'CreatedAt', 'CreatedBy', 'FeederID',
  'FindingIDs', 'CustomerImpact', 'PlanStart', 'PlanEnd', 'TeamOwner', 'NeedOutage', 'OutageHours',
  'Materials', 'Status', 'ActualStart', 'ActualEnd', 'ClosedBy', 'Result', 'Note'];

const PATROL_PHOTO_HEADERS = ['PhotoID', 'ParentType', 'ParentID', 'PhotoKind', 'DriveFileId',
  'DriveUrl', 'TakenAt', 'Lat', 'Lon', 'UploadedBy', 'Note'];

const PATROL_TYPE_HEADERS = ['TypeCode', 'TypeName', 'Category', 'DefaultSeverity', 'Active'];

// สถานะของ "จุดเสี่ยงที่ระบบคำนวณให้" (ไฟล์ risks.json) — เก็บเฉพาะรายการที่มีคนจัดการแล้ว
const SHEET_PATROL_RISK = 'PatrolRisk';

// ตัวนับการเข้าใช้แต่ละโปรแกรมในแพลตฟอร์ม — ใช้เรียงการ์ดในหน้าศูนย์รวมงานตามการใช้ล่าสุด
const SHEET_APP_USAGE = 'AppUsage';
const APP_USAGE_HEADERS = ['App', 'Count', 'LastUser', 'LastAt', 'TodayCount', 'TodayDate'];
const PATROL_RISK_HEADERS = ['RiskID', 'Status', 'FindingID', 'Note', 'UpdatedAt', 'UpdatedBy', 'History'];

const PATROL_TYPE_SEED = [
  ['TREE', 'ต้นไม้ใกล้สาย', 'หน้างาน', 2, 'TRUE'],
  ['SAG', 'สายหย่อน/พาดต่ำ', 'หน้างาน', 2, 'TRUE'],
  ['INSUL', 'ลูกถ้วยชำรุด', 'หน้างาน', 1, 'TRUE'],
  ['POLE', 'เสาเอียง/ร้าว/ผุ', 'หน้างาน', 1, 'TRUE'],
  ['DROPOUT', 'ดรอปเอาต์ชำรุด', 'หน้างาน', 1, 'TRUE'],
  ['HOTSPOT', 'จุดต่อร้อน', 'หน้างาน', 1, 'TRUE'],
  ['TELECOM', 'สายสื่อสารรุงรัง', 'หน้างาน', 3, 'TRUE'],
  ['OBSTACLE', 'สิ่งกีดขวาง/ป้าย', 'หน้างาน', 3, 'TRUE'],
  ['ANIMAL', 'สัตว์/นกทำรัง', 'หน้างาน', 2, 'TRUE'],
  ['THEFT', 'อุปกรณ์หาย/ถูกขโมย', 'หน้างาน', 1, 'TRUE'],
  ['GROUND', 'ระบบดินชำรุด', 'หน้างาน', 2, 'TRUE'],
  ['OVERLOAD', 'โหลดเกินพิกัด', 'ระบบคำนวณ', 2, 'TRUE'],
  ['LOWVOLT', 'แรงดันตก', 'ระบบคำนวณ', 2, 'TRUE'],
  ['FUSE', 'ฟิวส์ไม่ตรงพิกัด', 'ระบบคำนวณ', 2, 'TRUE']
];

/** คืนชีตที่ต้องการ สร้างพร้อมหัวตารางให้อัตโนมัติถ้ายังไม่มี */
function getOrCreatePatrolSheet_(name, headers, seedRows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (seedRows && seedRows.length) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
  }
  return sheet;
}

/** เติมหัวคอลัมน์ที่ตั้งให้ชีต PatrolFinding เดิมที่สร้างไว้ก่อนมีฟีเจอร์นี้ */
function ensureFindingHeaders_(sheet) {
  const names = { 21: 'NearPlace', 22: 'Address', 23: 'Moo', 24: 'Landmark',
                  25: 'OrderNo', 26: 'OrderDate', 27: 'FixedDate', 28: 'FixedBy', 29: 'FixedDetail' };
  Object.keys(names).forEach(function (col) {
    const c = parseInt(col, 10);
    if (String(sheet.getRange(1, c).getValue() || '').trim() === '') sheet.getRange(1, c).setValue(names[col]);
  });
}

/** อ่าน ตำแหน่ง (Role) และ สังกัด (Org) ของผู้ใช้จากคอลัมน์ C,D ของชีต Admins/Members */
function getUserProfile_(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return { position: '', org: '' };
  const sheets = [SHEET_ADMINS, SHEET_MEMBERS];
  for (let s = 0; s < sheets.length; s++) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheets[s]);
    if (!sheet) continue;
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim().toLowerCase() === lower) {
        return { position: String(values[i][2] || '').trim(), org: String(values[i][3] || '').trim() };
      }
    }
  }
  return { position: '', org: '' };
}

/** สร้างรหัสใหม่แบบ PREFIX-YYMMDD-HHMMSS-XXX (ไม่ซ้ำแม้บันทึกพร้อมกันหลายคน) */
function newPatrolId_(prefix) {
  const now = new Date();
  const stamp = Utilities.formatDate(now, 'GMT+7', 'yyMMdd-HHmmss');
  const rand = String(Math.floor(Math.random() * 1000));
  const pad = rand.length === 1 ? '00' + rand : (rand.length === 2 ? '0' + rand : rand);
  return prefix + '-' + stamp + '-' + pad;
}

/** โฟลเดอร์เก็บรูป Patrol แยกตามเดือน — PHOTO_ROOT/Patrol/YYYY-MM */
function getPatrolPhotoFolder_() {
  const root = DriveApp.getFolderById(PHOTO_ROOT_FOLDER_ID);
  let patrol;
  const it = root.getFoldersByName(PATROL_PHOTO_FOLDER);
  patrol = it.hasNext() ? it.next() : root.createFolder(PATROL_PHOTO_FOLDER);
  const monthName = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM');
  const it2 = patrol.getFoldersByName(monthName);
  return it2.hasNext() ? it2.next() : patrol.createFolder(monthName);
}

/**
 * อัปโหลดรูป 1 รูปขึ้น Drive แล้วบันทึกลงชีต PatrolPhoto
 * photo = { kind:'before'|'during'|'after', base64, mimeType, takenAt, lat, lon, note }
 */
function patrolUploadPhoto_(parentType, parentId, photo, uploadedBy) {
  const kind = photo.kind || 'before';
  const folder = getPatrolPhotoFolder_();
  const bytes = Utilities.base64Decode(photo.base64);
  const filename = parentId + '_' + kind + '_' + new Date().getTime() + '.jpg';
  const file = folder.createFile(Utilities.newBlob(bytes, photo.mimeType || 'image/jpeg', filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const photoId = newPatrolId_('PH');
  getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS).appendRow([
    photoId, parentType, parentId, kind, file.getId(), file.getUrl(),
    photo.takenAt || new Date(), photo.lat != null ? photo.lat : '', photo.lon != null ? photo.lon : '',
    uploadedBy, photo.note || ''
  ]);
  return { photoId: photoId, url: file.getUrl(), fileId: file.getId(), kind: kind };
}

/** แปลงแถวชีตเป็น object ตามหัวตาราง (แปลงวันที่เป็นข้อความอ่านง่าย) */
function patrolRowToObj_(headers, row) {
  const obj = {};
  headers.forEach(function (h, i) {
    const v = row[i];
    obj[h] = v instanceof Date ? Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd HH:mm') : v;
  });
  return obj;
}

/** ===================== ตัวจ่ายงาน (เรียกจาก doPost) =====================
 * คืน null ถ้าไม่ใช่คำสั่งของ Patrol (ให้ doPost ทำงานต่อตามปกติ)
 * ทุกคำสั่งในนี้ผ่านการตรวจสิทธิ์จาก doPost มาแล้ว (requesterRole ต้องไม่เป็น null)
 */
function handlePatrolAction_(body, requesterRole, changedByName) {
  const action = body && body.action;
  const SHARED_ACTIONS = ['appOpen', 'appStats'];
  if (!action || (String(action).indexOf('patrol') !== 0 && SHARED_ACTIONS.indexOf(action) < 0)) return null;

  PATROL_ROLE_HINT = requesterRole;
  // ตรวจสิทธิ์การใช้โปรแกรม Patrol ก่อนทุกคำสั่งที่เปลี่ยนแปลงข้อมูล (หน้าเว็บซ่อนปุ่มไว้แล้ว แต่กันไว้ที่หลังบ้านอีกชั้น)
  const WRITE_ACTIONS = ['patrolCreate', 'patrolAddPhoto', 'patrolUpdate', 'patrolDelete', 'patrolRiskSet', 'patrolCloseBulk'];
  if (WRITE_ACTIONS.indexOf(action) >= 0 && getUserApps_(changedByName, requesterRole).indexOf('patrol') < 0) {
    return jsonOut({ ok: false, error: 'บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งานโปรแกรม Patrol กรุณาติดต่อผู้ดูแลระบบ' });
  }

  switch (action) {
    case 'patrolBootstrap':   return patrolBootstrap_(changedByName);
    case 'patrolCreate':      return patrolCreateFinding_(body, changedByName);
    case 'patrolAddPhoto':    return patrolAddPhoto_(body, changedByName);
    case 'patrolList':        return patrolListFindings_(body);
    case 'patrolDetail':      return patrolFindingDetail_(body);
    case 'patrolUpdate':      return patrolUpdateFinding_(body, changedByName, requesterRole);
    case 'patrolAddType':     return patrolAddType_(body, requesterRole);
    case 'patrolDelete':      return patrolDeleteFinding_(body, changedByName, requesterRole);
    case 'patrolWhoAmI':      return patrolWhoAmI_(requesterRole, changedByName);
    case 'patrolListUsers':   return listUsersWithApps_(requesterRole);
    case 'patrolSetApps':     return setUserApps_(body, requesterRole, changedByName);
    case 'patrolSetAppBulk':  return setAppBulk_(body, requesterRole, changedByName);
    case 'patrolRiskStates':  return patrolRiskStates_();
    case 'patrolRiskSet':     return patrolRiskSet_(body, changedByName);
    case 'patrolCloseBulk':   return patrolCloseBulk_(body, changedByName);
    case 'appOpen':           return appOpen_(body, changedByName);
    case 'appStats':          return appStats_();
    default:
      return jsonOut({ ok: false, error: 'unknown patrol action: ' + action });
  }
}

/** ข้อมูลตั้งต้นที่หน้าเว็บต้องใช้ — ประเภทปัญหา + โปรไฟล์ผู้ใช้ (เรียกครั้งเดียวตอนเปิดแอป แล้วแคชไว้ใช้ตอนออฟไลน์) */
/* ===================== สิทธิ์การใช้งานรายโปรแกรม =====================
 * เก็บในชีต Admins/Members คอลัมน์ E = Apps เป็นรหัสโปรแกรมคั่นด้วยจุลภาค เช่น  sld,patrol
 * ผู้ดูแลระบบ (Admin) ใช้ได้ทุกโปรแกรมเสมอ ไม่ต้องกำหนด
 * สมาชิกที่ช่อง Apps ว่าง = ยังไม่เคยกำหนด ระบบถือว่าใช้ได้ทุกโปรแกรม (เพื่อไม่ให้คนเดิมหลุดออกจากระบบ)
 *   ถ้าต้องการจำกัดจริง ให้แอดมินกำหนดสิทธิ์ให้คนนั้นอย่างน้อย 1 โปรแกรม
 * ใส่ - (ขีด) = ไม่ให้ใช้โปรแกรมใดเลย (ระงับการใช้งานชั่วคราวโดยไม่ต้องลบบัญชี)
 */
const APP_LIST = [
  { code: 'sld',          name: 'Single Line Diagram' },
  { code: 'tx-survey',    name: 'สำรวจหม้อแปลง' },
  { code: 'patrol',       name: 'Patrol ระบบจำหน่าย' },
  { code: 'construction', name: 'สำรวจงานก่อสร้าง' }
];
const APPS_COL = 5;        // คอลัมน์ E = Apps (รหัสโปรแกรมที่ใช้ได้)
const APPS_META_COL = 6;   // คอลัมน์ F = AppsUpdated (แก้ล่าสุดเมื่อไหร่ โดยใคร เหตุผลอะไร)

/** หาแถวของผู้ใช้ในชีต Admins/Members คืน { sheet, row, role } */
function findUserRow_(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return null;
  const pairs = [[SHEET_ADMINS, 'admin'], [SHEET_MEMBERS, 'member']];
  for (let i = 0; i < pairs.length; i++) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(pairs[i][0]);
    if (!sheet) continue;
    const values = sheet.getDataRange().getValues();
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0] || '').trim().toLowerCase() === lower) {
        return { sheet: sheet, row: r + 1, role: pairs[i][1], values: values[r] };
      }
    }
  }
  return null;
}

/** คืนรายการรหัสโปรแกรมที่ผู้ใช้คนนี้ใช้ได้ — แอดมินได้ทุกโปรแกรม */
function getUserApps_(name, role) {
  if (role === 'admin') return APP_LIST.map(function (a) { return a.code; });
  const found = findUserRow_(name);
  const raw = found ? String(found.values[APPS_COL - 1] || '').trim() : '';
  if (!raw) return APP_LIST.map(function (a) { return a.code; });   // ยังไม่เคยกำหนด = ใช้ได้ทุกโปรแกรม
  if (raw === '-') return [];
  return raw.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}

/** รายชื่อผู้ใช้ทั้งหมดพร้อมสิทธิ์รายโปรแกรม — เฉพาะผู้ดูแลระบบ (ไม่ส่งรหัสผ่านออกไป) */
function listUsersWithApps_(requesterRole) {
  if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  const out = [];
  [[SHEET_ADMINS, 'admin'], [SHEET_MEMBERS, 'member']].forEach(function (pair) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(pair[0]);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    for (let r = 1; r < values.length; r++) {
      const name = String(values[r][0] || '').trim();
      if (!name) continue;
      const raw = String(values[r][APPS_COL - 1] || '').trim();
      out.push({
        name: name, role: pair[1],
        position: String(values[r][2] || '').trim(),
        org: String(values[r][3] || '').trim(),
        apps: pair[1] === 'admin' ? APP_LIST.map(function (a) { return a.code; }) : getUserApps_(name, 'member'),
        appsRaw: raw,
        appsUpdated: String(values[r][APPS_META_COL - 1] || '').trim()
      });
    }
  });
  return jsonOut({ ok: true, users: out, appList: APP_LIST });
}

/** เขียนค่าสิทธิ์ลงชีต พร้อมเติมหัวคอลัมน์และบันทึกว่าใครแก้เมื่อไหร่ด้วยเหตุผลอะไร */
function writeUserApps_(found, newVal, reason, changedByName) {
  if (String(found.sheet.getRange(1, APPS_COL).getValue() || '').trim() === '') {
    found.sheet.getRange(1, APPS_COL).setValue('Apps');
  }
  if (String(found.sheet.getRange(1, APPS_META_COL).getValue() || '').trim() === '') {
    found.sheet.getRange(1, APPS_META_COL).setValue('AppsUpdated');
  }
  found.sheet.getRange(found.row, APPS_COL).setValue(newVal);
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm') + ' โดย ' + changedByName +
                (reason ? ' — ' + reason : '');
  found.sheet.getRange(found.row, APPS_META_COL).setValue(stamp);
}

/**
 * เปิด/ปิดสิทธิ์โปรแกรมเดียวให้หลายคนพร้อมกัน — ใช้ตอนเปิดโปรแกรมใหม่ให้ทั้งแผนก
 * body = { app:'patrol', enable:[ชื่อ...], disable:[ชื่อ...], reason:'...' }
 */
function setAppBulk_(body, requesterRole, changedByName) {
  if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  const app = String(body.app || '').trim();
  const valid = APP_LIST.map(function (a) { return a.code; });
  if (valid.indexOf(app) < 0) return jsonOut({ ok: false, error: 'ไม่รู้จักโปรแกรมนี้' });
  const reason = String(body.reason || '').trim();
  const enable = (body.enable || []).map(function (x) { return String(x).trim(); });
  const disable = (body.disable || []).map(function (x) { return String(x).trim(); });

  let changed = 0;
  const skipped = [];
  const apply = function (name, turnOn) {
    const found = findUserRow_(name);
    if (!found) { skipped.push(name + ' (ไม่พบ)'); return; }
    if (found.role === 'admin') { skipped.push(name + ' (ผู้ดูแลระบบ)'); return; }
    const cur = getUserApps_(name, 'member');
    const has = cur.indexOf(app) >= 0;
    if (has === turnOn) return;
    const next = turnOn ? cur.concat([app]) : cur.filter(function (c) { return c !== app; });
    const newVal = next.length ? next.join(',') : '-';
    writeUserApps_(found, newVal, reason, changedByName);
    logChange('กำหนดสิทธิ์โปรแกรม (ทั้งชุด)', '', name, [
      { field: 'Apps', oldValue: String(found.values[APPS_COL - 1] || ''), newValue: newVal },
      { field: 'เหตุผล', oldValue: '', newValue: reason }
    ], changedByName);
    changed++;
  };
  enable.forEach(function (n) { apply(n, true); });
  disable.forEach(function (n) { apply(n, false); });
  return jsonOut({ ok: true, changed: changed, skipped: skipped });
}

/** กำหนดสิทธิ์รายโปรแกรมให้ผู้ใช้ — เฉพาะผู้ดูแลระบบ */
function setUserApps_(body, requesterRole, changedByName) {
  if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  const name = String(body.targetName || '').trim();
  if (!name) return jsonOut({ ok: false, error: 'ไม่ได้ระบุชื่อผู้ใช้' });
  const found = findUserRow_(name);
  if (!found) return jsonOut({ ok: false, error: 'ไม่พบผู้ใช้ชื่อนี้' });
  if (found.role === 'admin') return jsonOut({ ok: false, error: 'ผู้ดูแลระบบใช้ได้ทุกโปรแกรมอยู่แล้ว ไม่ต้องกำหนด' });

  const valid = APP_LIST.map(function (a) { return a.code; });
  const apps = (body.apps || []).map(function (x) { return String(x).trim(); })
                                .filter(function (x) { return valid.indexOf(x) >= 0; });
  const newVal = apps.length ? apps.join(',') : '-';
  const oldVal = String(found.values[APPS_COL - 1] || '');
  writeUserApps_(found, newVal, String(body.reason || '').trim(), changedByName);
  logChange('กำหนดสิทธิ์โปรแกรม', '', name, [
    { field: 'Apps', oldValue: oldVal, newValue: newVal },
    { field: 'เหตุผล', oldValue: '', newValue: String(body.reason || '') }
  ], changedByName);
  return jsonOut({ ok: true, apps: apps });
}

let PATROL_ROLE_HINT = '';
function patrolBootstrap_(changedByName) {
  const typeSheet = getOrCreatePatrolSheet_(SHEET_PATROL_TYPE, PATROL_TYPE_HEADERS, PATROL_TYPE_SEED);
  getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  getOrCreatePatrolSheet_(SHEET_PATROL_JOB, PATROL_JOB_HEADERS);
  getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS);

  const values = typeSheet.getDataRange().getValues();
  const types = [];
  for (let i = 1; i < values.length; i++) {
    const code = String(values[i][0] || '').trim();
    if (!code) continue;
    if (String(values[i][4] || 'TRUE').toUpperCase() === 'FALSE') continue;
    types.push({
      code: code,
      name: String(values[i][1] || '').trim(),
      category: String(values[i][2] || '').trim(),
      defaultSeverity: parseInt(values[i][3], 10) || 2
    });
  }
  const profile = getUserProfile_(changedByName);
  const apps = getUserApps_(changedByName, PATROL_ROLE_HINT);
  return jsonOut({ ok: true, types: types, appList: APP_LIST,
    profile: { name: changedByName, position: profile.position, org: profile.org,
               role: PATROL_ROLE_HINT, apps: apps, allowed: apps.indexOf('patrol') >= 0 } });
}

/**
 * บันทึกจุดที่พบใหม่ พร้อมรูป "ก่อนปรับปรุง" อย่างน้อย 1 รูป (บังคับ)
 * body = { action:'patrolCreate', finding:{...}, photos:[{kind,base64,mimeType,takenAt,lat,lon}] }
 */
function patrolCreateFinding_(body, changedByName) {
  const f = body.finding || {};
  const photos = body.photos || [];
  if (!f.problemType) return jsonOut({ ok: false, error: 'กรุณาเลือกประเภทปัญหา' });
  if (f.lat == null || f.lon == null) return jsonOut({ ok: false, error: 'ไม่มีพิกัดของจุดที่พบ' });

  // จุดที่ช่างบันทึกหน้างานต้องมีรูปเสมอ · จุดเสี่ยงที่ระบบคำนวณให้ยังไม่ต้องมีรูปจนกว่าจะออกไปตรวจจริง
  if (f.source !== 'system') {
    const beforeCount = photos.filter(function (p) { return (p.kind || 'before') === 'before' && p.base64; }).length;
    if (beforeCount < 1) return jsonOut({ ok: false, error: 'ต้องมีรูปก่อนปรับปรุงอย่างน้อย 1 รูป' });
  }

  const findingId = f.findingId && String(f.findingId).trim() ? String(f.findingId).trim() : newPatrolId_('F');

  // กันบันทึกซ้ำ — ถ้าเครื่องส่งซ้ำตอนสัญญาณกลับมา ให้ถือว่าสำเร็จโดยไม่เพิ่มแถวใหม่
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (String(existing[i][0] || '').trim() === findingId) {
      return jsonOut({ ok: true, findingId: findingId, duplicate: true });
    }
  }

  const profile = getUserProfile_(changedByName);
  ensureFindingHeaders_(sheet);
  sheet.appendRow([
    findingId,
    f.createdAt ? new Date(f.createdAt) : new Date(),
    changedByName,
    profile.position,
    profile.org,
    f.anchorType || 'POINT',
    f.anchorRef || '',
    f.lat, f.lon,
    f.gpsAccuracy != null ? f.gpsAccuracy : '',
    f.feederId || '',
    f.problemType,
    f.severity || 2,
    f.detail || '',
    f.source || 'field',
    'ใหม่',
    '', '', '', '',
    f.nearPlace || '', f.address || '', f.moo || '', f.landmark || ''
  ]);

  const uploaded = [], failed = [];
  photos.forEach(function (p) {
    if (!p || !p.base64) return;
    try { uploaded.push(patrolUploadPhoto_('FINDING', findingId, p, changedByName)); }
    catch (err) { failed.push(String(err)); }
  });

  logChange('Patrol: บันทึกจุดที่พบ', f.feederId || '', findingId,
    [{ field: 'ประเภทปัญหา', oldValue: '', newValue: f.problemType },
     { field: 'ความรุนแรง', oldValue: '', newValue: String(f.severity || 2) }], changedByName);

  return jsonOut({ ok: true, findingId: findingId, photos: uploaded, photoFailed: failed });
}

/** เพิ่มรูปให้จุดที่พบหรืองานที่มีอยู่แล้ว — เพิ่มได้ไม่จำกัดจำนวน ทุกเวลา */
function patrolAddPhoto_(body, changedByName) {
  const parentType = body.parentType === 'JOB' ? 'JOB' : 'FINDING';
  const parentId = String(body.parentId || '').trim();
  const photos = body.photos || [];
  if (!parentId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรายการที่จะเพิ่มรูป' });
  if (!photos.length) return jsonOut({ ok: false, error: 'ไม่มีรูปที่จะอัปโหลด' });
  const uploaded = [], failed = [];
  photos.forEach(function (p) {
    if (!p || !p.base64) return;
    try { uploaded.push(patrolUploadPhoto_(parentType, parentId, p, changedByName)); }
    catch (err) { failed.push(String(err)); }
  });
  return jsonOut({ ok: true, photos: uploaded, photoFailed: failed });
}

/** รายการจุดที่พบ — กรองตามสถานะ / วงจร / ความรุนแรง / ผู้บันทึก ได้ (ล่าสุดขึ้นก่อน) */
function patrolListFindings_(body) {
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const limit = Math.min(parseInt(body.limit, 10) || 300, 1000);
  const wantStatus = (body.status || '').trim();
  const wantFeeder = (body.feederId || '').trim();
  const wantSeverity = parseInt(body.severity, 10) || 0;
  const wantBy = (body.createdBy || '').trim().toLowerCase();

  const rows = [];
  for (let i = values.length - 1; i >= 1 && rows.length < limit; i--) {
    const r = values[i];
    if (!String(r[0] || '').trim()) continue;
    if (wantStatus && String(r[15] || '') !== wantStatus) continue;
    if (wantFeeder && String(r[10] || '') !== wantFeeder) continue;
    if (wantSeverity && parseInt(r[12], 10) !== wantSeverity) continue;
    if (wantBy && String(r[2] || '').toLowerCase() !== wantBy) continue;
    rows.push(patrolRowToObj_(headers, r));
  }
  return jsonOut({ ok: true, findings: rows, total: values.length - 1 });
}

/** รายละเอียดจุดที่พบ 1 รายการ พร้อมรูปทั้งหมดที่ผูกอยู่ */
function patrolFindingDetail_(body) {
  const id = String(body.findingId || '').trim();
  if (!id) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสจุดที่พบ' });
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  let finding = null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) { finding = patrolRowToObj_(headers, values[i]); break; }
  }
  if (!finding) return jsonOut({ ok: false, error: 'ไม่พบรายการนี้' });

  const pSheet = getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS);
  const pValues = pSheet.getDataRange().getValues();
  const pHeaders = pValues[0];
  const photos = [];
  for (let i = 1; i < pValues.length; i++) {
    if (String(pValues[i][2] || '').trim() === id) photos.push(patrolRowToObj_(pHeaders, pValues[i]));
  }
  return jsonOut({ ok: true, finding: finding, photos: photos });
}

/**
 * แก้ไขสถานะ / ความรุนแรง / รายละเอียด / ปิดจุดที่พบ
 * ปิดได้เฉพาะเมื่อมีรูปหลังปรับปรุงอย่างน้อย 1 รูป (ยกเว้นปิดแบบ "ไม่ใช่ปัญหา" ซึ่งต้องใส่เหตุผล)
 */
function patrolUpdateFinding_(body, changedByName, requesterRole) {
  const id = String(body.findingId || '').trim();
  if (!id) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสจุดที่พบ' });
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) { rowIndex = i; break; }
  }
  if (rowIndex < 0) return jsonOut({ ok: false, error: 'ไม่พบรายการนี้' });

  const newStatus = (body.status || '').trim();
  const changes = [];

  // ปิดแบบ "ไม่ใช่ปัญหา" — ไม่ต้องมีใบสั่งงานและรูป แต่ต้องมีเหตุผล
  if (newStatus === STATUS_NOTISSUE) {
    const reason = String(body.closeReason || '').trim();
    if (!reason) return jsonOut({ ok: false, error: 'กรุณาระบุเหตุผลที่ไม่ใช่ปัญหา' });
    ensureFindingHeaders_(sheet);
    sheet.getRange(rowIndex + 1, 18).setValue(new Date());
    sheet.getRange(rowIndex + 1, 19).setValue(changedByName);
    sheet.getRange(rowIndex + 1, 20).setValue(reason);
    changes.push({ field: 'เหตุผล', oldValue: '', newValue: reason });
  }

  if (newStatus === STATUS_CLOSED) {
    const err = validateCloseFields_(body);
    if (err) return jsonOut({ ok: false, error: err });
    if (!hasAfterPhoto_(id)) return jsonOut({ ok: false, error: 'ต้องมีรูปหลังปรับปรุงอย่างน้อย 1 รูป ก่อนปิดงาน' });
    ensureFindingHeaders_(sheet);
    writeCloseFields_(sheet, rowIndex + 1, body, changedByName);
    changes.push({ field: 'ใบสั่งงาน', oldValue: String(values[rowIndex][COL_ORDERNO - 1] || ''), newValue: String(body.orderNo) });
    changes.push({ field: 'ผู้ปฏิบัติงาน', oldValue: '', newValue: String(body.fixedBy) });
  }



  if (newStatus) {
    changes.push({ field: 'สถานะ', oldValue: String(values[rowIndex][15] || ''), newValue: newStatus });
    sheet.getRange(rowIndex + 1, 16).setValue(newStatus);
  }
  if (body.severity) {
    changes.push({ field: 'ความรุนแรง', oldValue: String(values[rowIndex][12] || ''), newValue: String(body.severity) });
    sheet.getRange(rowIndex + 1, 13).setValue(parseInt(body.severity, 10));
  }
  if (body.detail != null) {
    changes.push({ field: 'รายละเอียด', oldValue: String(values[rowIndex][13] || ''), newValue: String(body.detail) });
    sheet.getRange(rowIndex + 1, 14).setValue(String(body.detail));
  }
  if (body.problemType) {
    changes.push({ field: 'ประเภทปัญหา', oldValue: String(values[rowIndex][11] || ''), newValue: String(body.problemType) });
    sheet.getRange(rowIndex + 1, 12).setValue(String(body.problemType));
  }
  if (body.anchorType) {
    changes.push({ field: 'ผูกกับ', oldValue: String(values[rowIndex][5] || '') + ' ' + String(values[rowIndex][6] || ''),
                   newValue: String(body.anchorType) + ' ' + String(body.anchorRef || '') });
    sheet.getRange(rowIndex + 1, 6).setValue(String(body.anchorType));
    sheet.getRange(rowIndex + 1, 7).setValue(String(body.anchorRef || ''));
  }
  if (body.feederId != null) sheet.getRange(rowIndex + 1, 11).setValue(String(body.feederId));

  // ข้อมูลที่ตั้ง — แก้ได้ภายหลัง และใช้เติมย้อนหลังให้รายการที่บันทึกตอนไม่มีสัญญาณ
  ensureFindingHeaders_(sheet);
  [[ 'nearPlace', COL_NEARPLACE, 'สถานที่ใกล้เคียง' ],
   [ 'address',   COL_ADDRESS,   'ที่อยู่' ],
   [ 'moo',       COL_MOO,       'หมู่ที่/หมู่บ้าน' ],
   [ 'landmark',  COL_LANDMARK,  'จุดสังเกต' ]].forEach(function (f) {
    if (body[f[0]] == null) return;
    const oldVal = String(values[rowIndex][f[1] - 1] || '');
    const newVal = String(body[f[0]]);
    if (oldVal === newVal) return;
    sheet.getRange(rowIndex + 1, f[1]).setValue(newVal);
    changes.push({ field: f[2], oldValue: oldVal, newValue: newVal });
  });
  if (body.jobId != null) sheet.getRange(rowIndex + 1, 17).setValue(String(body.jobId));

  if (changes.length) logChange('Patrol: แก้ไขจุดที่พบ', String(values[rowIndex][10] || ''), id, changes, changedByName);
  return jsonOut({ ok: true });
}

/**
 * ลบจุดที่พบ — ใช้กับรายการที่บันทึกผิดหรือซ้ำ
 * สิทธิ์: ผู้ดูแลระบบลบได้ทุกรายการ · สมาชิกลบได้เฉพาะรายการที่ตัวเองบันทึกและยังอยู่สถานะ "ใหม่"
 * แถวใน PatrolFinding และ PatrolPhoto ถูกลบ ส่วนไฟล์รูปใน Drive ย้ายลงถังขยะ (กู้คืนได้ 30 วัน)
 * บันทึกลง ChangeLog ทุกครั้ง เพื่อให้ตรวจย้อนหลังได้ว่าใครลบอะไรด้วยเหตุผลใด
 */
function patrolDeleteFinding_(body, changedByName, requesterRole) {
  const id = String(body.findingId || '').trim();
  if (!id) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสจุดที่พบ' });
  const reason = String(body.reason || '').trim();
  if (!reason) return jsonOut({ ok: false, error: 'กรุณาระบุเหตุผลที่ลบ' });

  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) { rowIndex = i; break; }
  }
  if (rowIndex < 0) return jsonOut({ ok: false, error: 'ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)' });

  const row = values[rowIndex];
  const owner = String(row[2] || '').trim();
  const status = String(row[15] || '').trim();
  if (requesterRole !== 'admin') {
    if (owner.toLowerCase() !== String(changedByName || '').trim().toLowerCase()) {
      return jsonOut({ ok: false, error: 'ลบได้เฉพาะรายการที่ตัวเองบันทึกเท่านั้น' });
    }
    if (status !== 'ใหม่') {
      return jsonOut({ ok: false, error: 'รายการนี้เข้ากระบวนการแล้ว (สถานะ ' + status + ') ต้องให้ผู้ดูแลระบบลบให้' });
    }
  }

  const pSheet = getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS);
  const pValues = pSheet.getDataRange().getValues();
  let photoCount = 0;
  for (let i = pValues.length - 1; i >= 1; i--) {
    if (String(pValues[i][2] || '').trim() !== id) continue;
    const fileId = String(pValues[i][4] || '').trim();
    if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) {} }
    pSheet.deleteRow(i + 1);
    photoCount++;
  }
  sheet.deleteRow(rowIndex + 1);

  logChange('Patrol: ลบจุดที่พบ', String(row[10] || ''), id, [
    { field: 'ประเภทปัญหา', oldValue: String(row[11] || ''), newValue: '(ลบแล้ว)' },
    { field: 'ผู้บันทึกเดิม', oldValue: owner, newValue: '' },
    { field: 'เหตุผลที่ลบ', oldValue: '', newValue: reason },
    { field: 'จำนวนรูปที่ลบ', oldValue: String(photoCount), newValue: '' }
  ], changedByName);

  return jsonOut({ ok: true, deletedPhotos: photoCount });
}

/** คืนบทบาทของผู้เรียก — หน้าเว็บใช้ตัดสินว่าจะแสดงปุ่มลบหรือไม่ */
function patrolWhoAmI_(requesterRole, changedByName) {
  return jsonOut({ ok: true, role: requesterRole, name: changedByName });
}

/** ตรวจข้อมูลปิดงานให้ครบ — คืนข้อความผิดพลาด หรือ '' ถ้าผ่าน */
function validateCloseFields_(body) {
  const orderNo = String(body.orderNo || '').trim();
  if (!orderNo) return 'กรุณาระบุหมายเลขใบสั่งงาน';
  if (!/^\d+$/.test(orderNo)) return 'หมายเลขใบสั่งงานต้องเป็นตัวเลขล้วน';
  if (!String(body.orderDate || '').trim()) return 'กรุณาระบุวันที่ใบสั่งงาน';
  if (!String(body.fixedDate || '').trim()) return 'กรุณาระบุวันที่ดำเนินการจริง';
  if (!String(body.fixedBy || '').trim()) return 'กรุณาระบุผู้ปฏิบัติงาน';
  if (!String(body.fixedDetail || '').trim()) return 'กรุณาระบุสิ่งที่ดำเนินการ';
  return '';
}

/** มีรูปหลังปรับปรุงของจุดนี้หรือยัง */
function hasAfterPhoto_(findingId) {
  const pSheet = getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS);
  const pValues = pSheet.getDataRange().getValues();
  for (let i = 1; i < pValues.length; i++) {
    if (String(pValues[i][2] || '').trim() === findingId && String(pValues[i][3] || '') === 'after') return true;
  }
  return false;
}

/** เขียนข้อมูลปิดงานลงแถวที่ระบุ */
function writeCloseFields_(sheet, row, body, changedByName) {
  sheet.getRange(row, 16).setValue(STATUS_CLOSED);
  sheet.getRange(row, 18).setValue(new Date());          // ClosedAt = เวลาที่กดปิดในระบบ
  sheet.getRange(row, 19).setValue(changedByName);       // ClosedBy = คนที่กดปิด
  sheet.getRange(row, 20).setValue(String(body.fixedDetail || ''));
  sheet.getRange(row, COL_ORDERNO).setValue(String(body.orderNo || ''));
  sheet.getRange(row, COL_ORDERDATE).setValue(String(body.orderDate || ''));
  sheet.getRange(row, COL_FIXEDDATE).setValue(String(body.fixedDate || ''));
  sheet.getRange(row, COL_FIXEDBY).setValue(String(body.fixedBy || ''));
  sheet.getRange(row, COL_FIXEDDETAIL).setValue(String(body.fixedDetail || ''));
}

/**
 * ปิดหลายรายการด้วยใบสั่งงานใบเดียวกัน
 * รายการที่ยังไม่มีรูปหลังปรับปรุงจะถูกข้าม และรายงานกลับไปให้ผู้ใช้เห็น
 */
function patrolCloseBulk_(body, changedByName) {
  const ids = (body.ids || []).map(function (x) { return String(x).trim(); }).filter(function (x) { return x; });
  if (!ids.length) return jsonOut({ ok: false, error: 'ไม่ได้เลือกรายการ' });
  const err = validateCloseFields_(body);
  if (err) return jsonOut({ ok: false, error: err });

  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  ensureFindingHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const closed = [], noPhoto = [], notFound = [];

  ids.forEach(function (id) {
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === id) { rowIndex = i; break; }
    }
    if (rowIndex < 0) { notFound.push(id); return; }
    if (!hasAfterPhoto_(id)) { noPhoto.push(id); return; }
    writeCloseFields_(sheet, rowIndex + 1, body, changedByName);
    logChange('Patrol: ปิดงาน (ใบสั่งงานเดียวกัน)', String(values[rowIndex][10] || ''), id, [
      { field: 'ใบสั่งงาน', oldValue: '', newValue: String(body.orderNo) },
      { field: 'วันที่ดำเนินการ', oldValue: '', newValue: String(body.fixedDate) },
      { field: 'ผู้ปฏิบัติงาน', oldValue: '', newValue: String(body.fixedBy) }
    ], changedByName);
    closed.push(id);
  });

  return jsonOut({ ok: true, closed: closed.length, noPhoto: noPhoto, notFound: notFound });
}

/** เพิ่มประเภทปัญหาใหม่จากหน้าเว็บ — เฉพาะ Admin (ไม่ต้องแก้โค้ด) */
function patrolAddType_(body, requesterRole) {
  if (requesterRole !== 'admin') return jsonOut({ ok: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มประเภทปัญหาได้' });
  const code = String(body.typeCode || '').trim().toUpperCase();
  const name = String(body.typeName || '').trim();
  if (!code || !name) return jsonOut({ ok: false, error: 'กรุณาระบุรหัสและชื่อประเภทปัญหา' });
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_TYPE, PATROL_TYPE_HEADERS, PATROL_TYPE_SEED);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toUpperCase() === code) {
      return jsonOut({ ok: false, error: 'มีรหัสประเภทนี้อยู่แล้ว' });
    }
  }
  sheet.appendRow([code, name, String(body.category || 'หน้างาน'), parseInt(body.defaultSeverity, 10) || 2, 'TRUE']);
  return jsonOut({ ok: true });
}

/**
 * สถานะของจุดเสี่ยงที่มีคนจัดการแล้ว — รายการที่ยังไม่มีใครแตะจะไม่มีแถวในชีต ถือว่า "ยังไม่ตรวจ"
 */
function patrolRiskStates_() {
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_RISK, PATROL_RISK_HEADERS);
  const values = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (!id) continue;
    out[id] = {
      status: String(values[i][1] || ''),
      findingId: String(values[i][2] || ''),
      note: String(values[i][3] || ''),
      at: values[i][4] instanceof Date ? Utilities.formatDate(values[i][4], 'GMT+7', 'yyyy-MM-dd HH:mm') : String(values[i][4] || ''),
      by: String(values[i][5] || ''),
      history: String(values[i][6] || '').split('\n').filter(function (x) { return x; })
    };
  }
  return jsonOut({ ok: true, states: out });
}

/**
 * ตั้งสถานะจุดเสี่ยง 1 รายการ
 * status = 'รับเรื่อง' (สร้างเป็นจุดที่พบแล้ว) | 'ปัดทิ้ง' (ไม่ใช่ปัญหา) | 'ยังไม่ตรวจ' (ยกเลิกการปัดทิ้ง)
 */
function patrolRiskSet_(body, changedByName) {
  const id = String(body.riskId || '').trim();
  if (!id) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสจุดเสี่ยง' });
  const status = String(body.status || '').trim();
  if (['รับเรื่อง', 'ปัดทิ้ง', 'ยังไม่ตรวจ'].indexOf(status) < 0) return jsonOut({ ok: false, error: 'สถานะไม่ถูกต้อง' });
  if (status === 'ปัดทิ้ง' && !String(body.note || '').trim()) {
    return jsonOut({ ok: false, error: 'กรุณาระบุเหตุผลที่ปัดทิ้ง' });
  }
  const sheet = getOrCreatePatrolSheet_(SHEET_PATROL_RISK, PATROL_RISK_HEADERS);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) { rowIndex = i + 1; break; }
  }
  // ประวัติสะสม — ทุกการกระทำต่อจุดเสี่ยงนี้ถูกต่อท้ายไว้ ไม่ทับของเดิม
  const stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm');
  const line = stamp + ' · ' + changedByName + ' · ' + status +
               (body.note ? ' — ' + String(body.note) : '') +
               (body.findingId ? ' → ' + String(body.findingId) : '');
  const oldHist = rowIndex > 0 ? String(values[rowIndex - 1][6] || '') : '';
  const history = (oldHist ? oldHist + '\n' : '') + line;

  const row = [id, status, String(body.findingId || ''), String(body.note || ''), new Date(), changedByName, history];
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, PATROL_RISK_HEADERS.length).setValues([row]);
  else sheet.appendRow(row);

  logChange('Patrol: จุดเสี่ยง ' + status, '', id,
    [{ field: 'หมายเหตุ', oldValue: '', newValue: String(body.note || '') }], changedByName);
  return jsonOut({ ok: true });
}

/**
 * บันทึกว่ามีคนเปิดใช้โปรแกรมไหน — นับจำนวนครั้งรวม จำนวนครั้งวันนี้ และเก็บชื่อคนล่าสุด
 * ทุกแอปในแพลตฟอร์มเรียกคำสั่งนี้ได้ ไม่เฉพาะ Patrol
 */
function appOpen_(body, changedByName) {
  const app = String(body.app || '').trim();
  if (!app) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสโปรแกรม' });
  const sheet = getOrCreatePatrolSheet_(SHEET_APP_USAGE, APP_USAGE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === app) { rowIndex = i; break; }
  }
  if (rowIndex < 0) {
    sheet.appendRow([app, 1, changedByName, new Date(), 1, today]);
  } else {
    const count = (parseInt(values[rowIndex][1], 10) || 0) + 1;
    const sameDay = String(values[rowIndex][5] || '').indexOf(today) === 0;
    const todayCount = sameDay ? (parseInt(values[rowIndex][4], 10) || 0) + 1 : 1;
    sheet.getRange(rowIndex + 1, 1, 1, APP_USAGE_HEADERS.length)
         .setValues([[app, count, changedByName, new Date(), todayCount, today]]);
  }
  return jsonOut({ ok: true });
}

/** สถิติการใช้งานทุกโปรแกรม — หน้าศูนย์รวมงานใช้เรียงการ์ดและแสดงชื่อผู้เข้าล่าสุด */
function appStats_() {
  const sheet = getOrCreatePatrolSheet_(SHEET_APP_USAGE, APP_USAGE_HEADERS);
  const values = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const app = String(values[i][0] || '').trim();
    if (!app) continue;
    const sameDay = String(values[i][5] || '').indexOf(today) === 0;
    out[app] = {
      count: parseInt(values[i][1], 10) || 0,
      lastUser: String(values[i][2] || ''),
      lastAt: values[i][3] instanceof Date ? Utilities.formatDate(values[i][3], 'GMT+7', 'yyyy-MM-dd HH:mm') : String(values[i][3] || ''),
      lastTs: values[i][3] instanceof Date ? values[i][3].getTime() : 0,
      today: sameDay ? (parseInt(values[i][4], 10) || 0) : 0
    };
  }
  return jsonOut({ ok: true, stats: out, appList: APP_LIST });
}

/** สร้างชีตของ Patrol ให้ครบ — เปิด Apps Script แล้วเลือกฟังก์ชันนี้ กด Run 1 ครั้ง */
function patrolSetup() {
  getOrCreatePatrolSheet_(SHEET_PATROL_FINDING, PATROL_FINDING_HEADERS);
  getOrCreatePatrolSheet_(SHEET_PATROL_JOB, PATROL_JOB_HEADERS);
  getOrCreatePatrolSheet_(SHEET_PATROL_PHOTO, PATROL_PHOTO_HEADERS);
  getOrCreatePatrolSheet_(SHEET_PATROL_TYPE, PATROL_TYPE_HEADERS, PATROL_TYPE_SEED);
  getOrCreatePatrolSheet_(SHEET_PATROL_RISK, PATROL_RISK_HEADERS);
  getOrCreatePatrolSheet_(SHEET_APP_USAGE, APP_USAGE_HEADERS);
  Logger.log('สร้างชีต Patrol ครบแล้ว');
}


/* ===========================================================================
 *  นำเข้าอุปกรณ์จาก GIS เข้าชีต Devices — เรียกใช้จาก Apps Script editor (กด Run)
 *
 *  วิธีใช้
 *  1) สร้างชีตชื่อ ImportGIS (ถ้ายังไม่มี)
 *  2) ไฟล์ > นำเข้า > อัปโหลด import_transformers_gis.csv > เลือก "แทนที่ชีตปัจจุบัน" ขณะอยู่ที่ชีต ImportGIS
 *  3) เลือกฟังก์ชัน importGisDevices แล้วกด Run
 *
 *  ความปลอดภัย
 *  - เพิ่มเฉพาะรายการที่ยังไม่มีในชีต Devices (ตรวจจาก DeviceID) ไม่ทับของเดิมเด็ดขาด รันซ้ำได้ไม่เกิดรายการซ้ำ
 *  - ทุกแถวที่เพิ่มมี Source = gis-import และบันทึกลง ChangeLog
 *  - ผลลัพธ์รายแถวเขียนไว้ที่คอลัมน์ W ของชีต ImportGIS
 *  - ถ้าต้องการยกเลิก ใช้ฟังก์ชัน undoGisImport ลบเฉพาะแถวที่นำเข้าจาก GIS ที่ยังไม่มีใครแก้ไข
 * =========================================================================== */
function importGisDevices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('ImportGIS');
  if (!src) throw new Error('ไม่พบชีต ImportGIS — สร้างชีตนี้แล้วนำเข้าไฟล์ CSV ก่อน');
  const dev = ss.getSheetByName(SHEET_DEVICES);
  ensureDeviceHeaders_(dev);

  const rows = src.getDataRange().getValues();
  if (rows.length < 2) throw new Error('ชีต ImportGIS ว่างเปล่า');
  const head = rows[0].map(function (h) { return String(h).trim(); });
  if (head[1] !== 'DeviceID') throw new Error('หัวคอลัมน์ไม่ตรง — คอลัมน์ B ต้องเป็น DeviceID (นำเข้าไฟล์ CSV ทั้งไฟล์รวมหัวตาราง)');

  const devValues = dev.getDataRange().getValues();
  const have = {};
  for (let i = 1; i < devValues.length; i++) have[String(devValues[i][1]).trim()] = true;

  const now = new Date(), who = 'นำเข้าจาก GIS (ระบบ)';
  const toAppend = [], logRows = [], results = [];
  let added = 0, skipped = 0, bad = 0, noParent = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const feeder = String(r[0] || '').trim(), id = String(r[1] || '').trim();
    if (!feeder || !id) { results.push(['ข้อมูลไม่ครบ']); bad++; continue; }
    if (have[id]) { results.push(['มีอยู่แล้ว ข้าม']); skipped++; continue; }
    const row = r.slice(0, 22);
    while (row.length < 22) row.push('');
    toAppend.push(row);
    have[id] = true;
    const parentOk = have[String(r[8] || '').trim()];
    if (!parentOk) noParent++;
    results.push([parentOk ? 'นำเข้าแล้ว' : 'นำเข้าแล้ว — แต่ไม่พบอุปกรณ์ต้นทาง ' + r[8] + ' ในผัง']);
    logRows.push([now, feeder, id, 'นำเข้าจาก GIS', 'ต่อจาก', '', String(r[8] || ''), who]);
    added++;
  }

  if (toAppend.length) dev.getRange(dev.getLastRow() + 1, 1, toAppend.length, 22).setValues(toAppend);
  if (logRows.length) {
    let log = ss.getSheetByName(SHEET_CHANGE_LOG);
    if (!log) { log = ss.insertSheet(SHEET_CHANGE_LOG); log.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Action', 'Field', 'OldValue', 'NewValue', 'ChangedBy']); }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 8).setValues(logRows);
  }
  src.getRange(1, 23).setValue('ผลการนำเข้า');
  if (results.length) src.getRange(2, 23, results.length, 1).setValues(results);

  const msg = 'นำเข้าแล้ว ' + added + ' รายการ · มีอยู่แล้วข้าม ' + skipped + ' · ข้อมูลไม่ครบ ' + bad +
              (noParent ? ' · ไม่พบต้นทาง ' + noParent : '');
  Logger.log(msg);
  return msg;
}

/** ยกเลิกการนำเข้า — ลบเฉพาะแถวที่ Source ยังเป็น gis-import (แถวที่มีคนตรวจหรือแก้แล้วจะไม่ถูกลบ) */
function undoGisImport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dev = ss.getSheetByName(SHEET_DEVICES);
  const values = dev.getDataRange().getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][7] || '').trim() === 'gis-import' && !String(values[i][10] || '').trim()) {
      logChange('ยกเลิกการนำเข้าจาก GIS', values[i][0], values[i][1], [], 'ยกเลิกการนำเข้า (ระบบ)');
      dev.deleteRow(i + 1);
      removed++;
    }
  }
  Logger.log('ลบแถวที่นำเข้าจาก GIS แล้ว ' + removed + ' รายการ');
  return removed;
}


/* ===========================================================================
 *  แก้อุปกรณ์ต้นทาง (ParentID) ตามแนวสายจริงใน GIS — เรียกใช้จาก Apps Script editor
 *
 *  วิธีใช้
 *  1) สร้างชีตชื่อ FixParentGIS แล้วนำเข้าไฟล์ fix_parents_gis.csv (แทนที่ชีตปัจจุบัน)
 *  2) เลือกฟังก์ชัน fixParentsFromGis แล้วกด Run
 *
 *  ความปลอดภัย
 *  - แก้เฉพาะแถวที่ ParentID ปัจจุบัน "ยังตรงกับค่าเดิม" ในไฟล์ ถ้ามีคนแก้ไปก่อนแล้วจะข้าม ไม่ทับงานคนอื่น
 *  - ทำเครื่องหมาย ParentConfidence = gis-topology และลง ChangeLog ทุกแถว
 *  - ยกเลิกได้ด้วย undoFixParents (คืนค่าเดิมเฉพาะแถวที่ยังเป็นค่าที่ระบบแก้ไว้)
 * =========================================================================== */
function fixParentsFromGis() {
  return applyParentFix_(false);
}
function undoFixParents() {
  return applyParentFix_(true);
}
function applyParentFix_(undo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('FixParentGIS');
  if (!src) throw new Error('ไม่พบชีต FixParentGIS — สร้างชีตนี้แล้วนำเข้าไฟล์ fix_parents_gis.csv ก่อน');
  const rows = src.getDataRange().getValues();
  if (String(rows[0][1]).trim() !== 'DeviceID') throw new Error('หัวคอลัมน์ไม่ตรง — คอลัมน์ B ต้องเป็น DeviceID');

  const dev = ss.getSheetByName(SHEET_DEVICES);
  const values = dev.getDataRange().getValues();
  const rowById = {};
  for (let i = 1; i < values.length; i++) rowById[String(values[i][1]).trim()] = i;

  const now = new Date(), who = undo ? 'ยกเลิกแก้ต้นทางจาก GIS (ระบบ)' : 'แก้ต้นทางตาม GIS (ระบบ)';
  const logRows = [], results = [];
  let done = 0, skipped = 0, missing = 0;

  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][1] || '').trim();
    const oldP = String(rows[i][2] || '').trim(), newP = String(rows[i][3] || '').trim();
    const idx = rowById[id];
    if (idx === undefined) { results.push(['ไม่พบอุปกรณ์ในผัง']); missing++; continue; }
    const cur = String(values[idx][8] || '').trim();
    const expect = undo ? newP : oldP, target = undo ? oldP : newP;
    if (cur !== expect) {
      results.push([cur === target ? (undo ? 'เป็นค่าเดิมอยู่แล้ว' : 'แก้ไปแล้ว') : 'มีคนแก้เป็น ' + cur + ' แล้ว — ข้าม']);
      skipped++; continue;
    }
    values[idx][8] = target;
    values[idx][19] = undo ? '' : 'gis-topology';
    dev.getRange(idx + 1, 9).setValue(target);
    dev.getRange(idx + 1, 20).setValue(values[idx][19]);
    logRows.push([now, values[idx][0], id, undo ? 'ยกเลิกแก้ต้นทาง' : 'แก้ต้นทางตาม GIS',
                  'ต่อจากอุปกรณ์ (ParentID)', expect, target, who]);
    results.push([undo ? 'คืนค่าเดิมแล้ว' : 'แก้แล้ว']);
    done++;
  }

  if (logRows.length) {
    let log = ss.getSheetByName(SHEET_CHANGE_LOG);
    if (!log) { log = ss.insertSheet(SHEET_CHANGE_LOG); log.appendRow(['Timestamp', 'Feeder', 'DeviceID', 'Action', 'Field', 'OldValue', 'NewValue', 'ChangedBy']); }
    log.getRange(log.getLastRow() + 1, 1, logRows.length, 8).setValues(logRows);
  }
  src.getRange(1, 7).setValue(undo ? 'ผลการยกเลิก' : 'ผลการแก้ไข');
  if (results.length) src.getRange(2, 7, results.length, 1).setValues(results);

  const msg = (undo ? 'คืนค่าเดิม ' : 'แก้ต้นทางแล้ว ') + done + ' รายการ · ข้าม ' + skipped + ' · ไม่พบ ' + missing;
  Logger.log(msg);
  return msg;
}

/* ==========================================================================
 *  การวัดโหลดหม้อแปลง (TxLoad)  —  เพิ่มใหม่
 * --------------------------------------------------------------------------
 *  วัดได้ทุกเครื่อง ไม่จำกัดขนาดหรือชนิด · เก็บเป็นประวัติ ไม่ทับของเก่า
 *  ชีตที่ใช้
 *    TxLoad        1 แถว = 1 ครั้งที่วัด
 *    TxLoadFeeder  1 แถว = 1 วงจรแรงต่ำของครั้งนั้น (รองรับ 1–6 วงจร)
 *    TxLoadPhoto   1 แถว = 1 รูป (ไฟล์เก็บใน Drive โฟลเดอร์เดิม PHOTO_ROOT/TxLoad/YYYY-MM)
 *  ชีต Devices เพิ่ม 2 คอลัมน์ X,Y = LastLoadAt, LastLoadPercent
 *    ทั้งสองช่องว่าง = ยังไม่เคยวัด = หน้าเว็บจะไม่แสดงสัญลักษณ์
 *  สิทธิ์: ผู้มีสิทธิ์แอป tx-survey บันทึกได้ · แก้/ลบของคนอื่นได้เฉพาะแอดมิน
 * ========================================================================== */

const SHEET_TXLOAD        = 'TxLoad';
const SHEET_TXLOAD_FEEDER = 'TxLoadFeeder';
const SHEET_TXLOAD_PHOTO  = 'TxLoadPhoto';
const SHEET_TXLOAD_END    = 'TxLoadEnd';
const TXLOAD_PHOTO_FOLDER = 'TxLoad';       // โฟลเดอร์ย่อยใน PHOTO_ROOT_FOLDER_ID

const TXLOAD_HEADERS = ['LoadID', 'DeviceID', 'Feeder', 'MeasuredAt', 'MeasuredBy', 'MeasuredByRole', 'Org',
  'SysConfig', 'NumFeeders', 'MeasurePoint', 'RatedKva',
  'Va', 'Vb', 'Vc', 'Vng', 'Vab', 'Vbc', 'Vca',
  'Ia', 'Ib', 'Ic', 'In',
  'KvaMeasured', 'LoadPercent', 'UnbalancePercent', 'InPercent', 'Verdict',
  'Recommend', 'Note', 'MeterModel', 'Weather', 'Period',
  'Lat', 'Lon', 'Address', 'Moo', 'PoleTag', 'Status', 'UpdatedAt', 'UpdatedBy'];

const TXLOAD_FEEDER_HEADERS = ['LoadID', 'FeederNo', 'FeederName', 'Ia', 'Ib', 'Ic', 'In',
  'CableSize', 'BreakerSize', 'Note'];

/* จุดปลายสายของการวัดหนึ่งครั้ง — หลายแถวต่อ 1 LoadID เหมือน TxLoadFeeder
   เก็บเฉพาะแรงดัน ไม่มีกระแส · DropPercent คือ % แรงดันตกสูงสุดของจุดนั้น */
const TXLOAD_END_HEADERS = ['LoadID', 'EndNo', 'EndName', 'FeederNo',
                            'Va', 'Vb', 'Vc', 'Vng', 'Vab', 'Vbc', 'Vca',
                            'Lat', 'Lon', 'DistanceM', 'DropPercent', 'Note'];
const TXLOAD_PHOTO_HEADERS = ['PhotoID', 'LoadID', 'DeviceID', 'PhotoKind', 'DriveFileId', 'DriveUrl',
  'TakenAt', 'Lat', 'Lon', 'UploadedBy', 'Caption'];

// คอลัมน์ใหม่ในชีต Devices (1-based)
const DEV_COL_LASTLOAD_AT  = 24;   // X
const DEV_COL_LASTLOAD_PCT = 25;   // Y
const DEV_COL_LASTLOAD_KVA = 26;   // Z
const DEV_COL_LASTLOAD_VER = 27;   // AA

/* ---- เกณฑ์ตัดสิน — แก้ที่นี่ที่เดียว หน้าเว็บอ่านค่าเดียวกันผ่าน txLoadBootstrap ---- */
const TXLOAD_RULES = {
  overload: 100,      // % โหลด เกินกว่านี้ = โหลดเกินพิกัด
  nearFull: 80,       // % โหลด ตั้งแต่นี้ = ใกล้เต็ม
  unbalance: 10,      // % ความไม่สมดุลระหว่างเฟส เกินกว่านี้ = ควรสลับเฟส
  inPercent: 20,      // กระแสนิวทรัลคิดเป็น % ของค่าเฉลี่ย เกินกว่านี้ = ผิดปกติ
  vNominal: 230,      // แรงดันเฟส-นิวทรัลพิกัด
  vTolerance: 10,     // ± % ที่ยอมรับ (207–253 V)
  reMeasureMonths: 12 // วัดเกินกี่เดือนถือว่าควรวัดใหม่
};

/** รูปแบบระบบแรงต่ำที่รองรับ — กำหนดว่าช่องไหนต้องขึ้นให้กรอก */
const TXLOAD_CONFIGS = {
  '1P2W': { label: '1 เฟส 2 สาย · 230 V',            phases: ['A'],           neutral: true,  lineToLine: false },
  '1P3W': { label: '1 เฟส 3 สาย · 230/460 V',        phases: ['A', 'B'],      neutral: true,  lineToLine: true  },
  '3P4W': { label: '3 เฟส 4 สาย · 400/230 V',        phases: ['A', 'B', 'C'], neutral: true,  lineToLine: true  },
  '3P3W': { label: '3 เฟส 3 สาย · 400 V',            phases: ['A', 'B', 'C'], neutral: false, lineToLine: true  }
};

/** ตั้งค่าครั้งแรก — รันมือครั้งเดียวจากเมนู Apps Script (ปลอดภัย รันซ้ำได้ ไม่ลบข้อมูล) */
function txLoadSetup() {
  getOrCreatePatrolSheet_(SHEET_TXLOAD, TXLOAD_HEADERS);
  getOrCreatePatrolSheet_(SHEET_TXLOAD_FEEDER, TXLOAD_FEEDER_HEADERS);
  getOrCreatePatrolSheet_(SHEET_TXLOAD_END, TXLOAD_END_HEADERS);
  getOrCreatePatrolSheet_(SHEET_TXLOAD_PHOTO, TXLOAD_PHOTO_HEADERS);
  const dev = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
  if (dev) ensureTxLoadDeviceHeaders_(dev);
  txPlanSetup();
  Logger.log('เตรียมชีตการวัดโหลดหม้อแปลงเรียบร้อย — TxLoad / TxLoadFeeder / TxLoadPhoto '
    + '/ TxLoadPlan / TxLoadPlanItem และคอลัมน์ LastLoadAt, LastLoadPercent, LastLoadKva, '
    + 'LastLoadVerdict ในชีต Devices');
}

/** เติมหัวคอลัมน์ X,Y ให้ชีต Devices ถ้ายังไม่มี */
function ensureTxLoadDeviceHeaders_(sheet) {
  const names = {};
  names[DEV_COL_LASTLOAD_AT] = 'LastLoadAt';
  names[DEV_COL_LASTLOAD_PCT] = 'LastLoadPercent';
  names[DEV_COL_LASTLOAD_KVA] = 'LastLoadKva';
  names[DEV_COL_LASTLOAD_VER] = 'LastLoadVerdict';
  Object.keys(names).forEach(function (col) {
    const c = parseInt(col, 10);
    if (String(sheet.getRange(1, c).getValue() || '').trim() === '') sheet.getRange(1, c).setValue(names[col]);
  });
}

/** โฟลเดอร์เก็บรูปการวัดโหลด แยกตามเดือน — PHOTO_ROOT/TxLoad/YYYY-MM */
function getTxLoadPhotoFolder_() {
  const root = DriveApp.getFolderById(PHOTO_ROOT_FOLDER_ID);
  const it = root.getFoldersByName(TXLOAD_PHOTO_FOLDER);
  const base = it.hasNext() ? it.next() : root.createFolder(TXLOAD_PHOTO_FOLDER);
  const monthName = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM');
  const it2 = base.getFoldersByName(monthName);
  return it2.hasNext() ? it2.next() : base.createFolder(monthName);
}

function txNum_(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * คำนวณผลจากค่าที่วัด — ใช้สูตรเดียวกับหน้าเว็บ เพื่อให้ตัวเลขในชีตตรงกับที่ผู้ใช้เห็นเสมอ
 *   kVA         = Σ (แรงดันเฟส-นิวทรัล × กระแสเฟสนั้น) ÷ 1000
 *                 ระบบ 3 เฟส 3 สาย ไม่มีนิวทรัล ใช้ √3 × Vเฉลี่ยเฟส-เฟส × Iเฉลี่ย ÷ 1000
 *   % โหลด      = kVA ÷ พิกัด × 100
 *   ไม่สมดุล    = (Imax − Iเฉลี่ย) ÷ Iเฉลี่ย × 100
 *   IN %        = In ÷ Iเฉลี่ย × 100
 */
function txLoadCompute_(m) {
  const cfg = TXLOAD_CONFIGS[m.sysConfig] || TXLOAD_CONFIGS['3P4W'];
  const iByPhase = { A: txNum_(m.ia), B: txNum_(m.ib), C: txNum_(m.ic) };
  const vByPhase = { A: txNum_(m.va), B: txNum_(m.vb), C: txNum_(m.vc) };
  const currents = cfg.phases.map(function (p) { return iByPhase[p] || 0; });

  let kva = 0;
  if (cfg.neutral) {
    cfg.phases.forEach(function (p) {
      const v = vByPhase[p], i = iByPhase[p];
      if (v != null && i != null) kva += v * i;
    });
    kva = kva / 1000;
  } else {
    const vll = [txNum_(m.vab), txNum_(m.vbc), txNum_(m.vca)].filter(function (x) { return x != null; });
    const vAvg = vll.length ? vll.reduce(function (a, b) { return a + b; }, 0) / vll.length : 0;
    const iAvg = currents.length ? currents.reduce(function (a, b) { return a + b; }, 0) / currents.length : 0;
    kva = Math.sqrt(3) * vAvg * iAvg / 1000;
  }

  const rated = txNum_(m.ratedKva);
  const loadPercent = (rated && rated > 0) ? kva / rated * 100 : null;

  const nonZero = currents.filter(function (x) { return x > 0; });
  const iAvg = nonZero.length ? nonZero.reduce(function (a, b) { return a + b; }, 0) / nonZero.length : 0;
  const iMax = nonZero.length ? Math.max.apply(null, nonZero) : 0;
  const unbalance = (cfg.phases.length > 1 && iAvg > 0) ? (iMax - iAvg) / iAvg * 100 : null;
  const inA = txNum_(m['in']);
  // กระแสนิวทรัลคิดเป็น % ของค่าเฉลี่ย — มีความหมายเฉพาะระบบหลายเฟส
  // ระบบ 1 เฟส 2 สาย นิวทรัลรับกระแสเท่ากับสายเฟสอยู่แล้วตามธรรมชาติ ไม่ใช่ความผิดปกติ จึงไม่คิดและไม่ตัดสิน
  const inPercent = (cfg.neutral && cfg.phases.length > 1 && inA != null && iAvg > 0)
    ? inA / iAvg * 100 : null;

  // แรงดันต่ำสุด/สูงสุดที่วัดได้ — ใช้เฉพาะเฟส-นิวทรัล เพราะเทียบกับ 230 V ±10%
  const vPhase = cfg.neutral
    ? cfg.phases.map(function (p) { return vByPhase[p]; }).filter(function (x) { return x != null; })
    : [];
  const vMin = vPhase.length ? Math.min.apply(null, vPhase) : null;
  const vMax = vPhase.length ? Math.max.apply(null, vPhase) : null;
  const vLo = TXLOAD_RULES.vNominal * (1 - TXLOAD_RULES.vTolerance / 100);
  const vHi = TXLOAD_RULES.vNominal * (1 + TXLOAD_RULES.vTolerance / 100);

  let verdict = 'ปกติ';
  if (loadPercent != null && loadPercent > TXLOAD_RULES.overload) verdict = 'โหลดเกินพิกัด';
  else if (vMin != null && vMin < vLo) verdict = 'แรงดันต่ำกว่าเกณฑ์';
  else if (vMax != null && vMax > vHi) verdict = 'แรงดันสูงกว่าเกณฑ์';
  else if (unbalance != null && unbalance > TXLOAD_RULES.unbalance) verdict = 'ไม่สมดุลระหว่างเฟส';
  else if (inPercent != null && inPercent > TXLOAD_RULES.inPercent) verdict = 'กระแสนิวทรัลสูง';
  else if (loadPercent != null && loadPercent >= TXLOAD_RULES.nearFull) verdict = 'ใกล้เต็มพิกัด';

  const r1 = function (x) { return x == null ? null : Math.round(x * 10) / 10; };
  return { kva: r1(kva), loadPercent: r1(loadPercent), unbalance: r1(unbalance),
           inPercent: r1(inPercent), vMin: vMin, vMax: vMax, verdict: verdict };
}

/** รวมกระแสทุกวงจรเป็นค่ารวมของหม้อแปลง — ใช้เมื่อวัดแบบรายวงจร */
function txLoadSumFeeders_(feeders) {
  const sum = { ia: 0, ib: 0, ic: 0, in: 0 };
  let any = false;
  (feeders || []).forEach(function (f) {
    ['ia', 'ib', 'ic', 'in'].forEach(function (k) {
      const v = txNum_(f[k]);
      if (v != null) { sum[k] += v; any = true; }
    });
  });
  return any ? sum : null;
}

/** ข้อมูลตั้งต้นที่หน้าเว็บต้องใช้ — เกณฑ์ตัดสิน + รูปแบบระบบ + สรุปผลวัดล่าสุดรายเครื่อง */
function txLoadBootstrap_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXLOAD);
  const latest = {};
  if (sheet) {
    const values = sheet.getDataRange().getValues();
    const H = {};
    (values[0] || []).forEach(function (h, i) { H[String(h).trim()] = i; });
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const id = String(row[H['DeviceID']] || '').trim();
      if (!id) continue;
      if (String(row[H['Status']] || '').trim() === 'ยกเลิก') continue;
      const at = row[H['MeasuredAt']];
      const atStr = at instanceof Date ? Utilities.formatDate(at, 'GMT+7', 'yyyy-MM-dd HH:mm') : String(at || '');
      const prev = latest[id];
      if (prev && prev.at >= atStr) continue;
      latest[id] = {
        at: atStr,
        pct: txNum_(row[H['LoadPercent']]),
        kva: txNum_(row[H['KvaMeasured']]),
        unb: txNum_(row[H['UnbalancePercent']]),
        inp: txNum_(row[H['InPercent']]),
        verdict: String(row[H['Verdict']] || ''),
        by: String(row[H['MeasuredBy']] || ''),
        cfg: String(row[H['SysConfig']] || ''),
        loadId: String(row[H['LoadID']] || '')
      };
    }
  }
  return jsonOut({ ok: true, rules: TXLOAD_RULES, configs: TXLOAD_CONFIGS, latest: latest });
}

/** บันทึกผลการวัด 1 ครั้ง (พร้อมวงจรย่อยและรูป) */
function txLoadSave_(body, changedByName, requesterRole) {
  const m = body.measure || {};
  const deviceId = String(m.deviceId || '').trim();
  if (!deviceId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุหมายเลขหม้อแปลง' });
  if (!TXLOAD_CONFIGS[m.sysConfig]) return jsonOut({ ok: false, error: 'รูปแบบระบบแรงต่ำไม่ถูกต้อง' });

  // ถ้าวัดรายวงจร ให้รวมกระแสจากวงจรย่อยเป็นค่ารวม (ค่าที่ส่งมาตรงๆ ใช้เมื่อวัดที่ขั้ว/ตู้รวม)
  const feeders = Array.isArray(body.feeders) ? body.feeders.slice(0, 6) : [];
  const ends = Array.isArray(body.ends) ? body.ends.slice(0, 6) : [];
  const sum = (m.measurePoint === 'รายวงจร') ? txLoadSumFeeders_(feeders) : null;
  const merged = {
    sysConfig: m.sysConfig, ratedKva: m.ratedKva,
    va: m.va, vb: m.vb, vc: m.vc, vng: m.vng, vab: m.vab, vbc: m.vbc, vca: m.vca,
    ia: sum ? sum.ia : m.ia, ib: sum ? sum.ib : m.ib, ic: sum ? sum.ic : m.ic, in: sum ? sum['in'] : m['in']
  };
  const calc = txLoadCompute_(merged);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreatePatrolSheet_(SHEET_TXLOAD, TXLOAD_HEADERS);
  const loadId = newPatrolId_('TL');
  const profile = getUserProfile_(changedByName);
  const now = new Date();
  const measuredAt = m.measuredAt ? new Date(m.measuredAt) : now;

  sheet.appendRow([loadId, deviceId, String(m.feeder || '').trim(),
    measuredAt, changedByName, profile.position || '', profile.org || '',
    m.sysConfig, feeders.length || txNum_(m.numFeeders) || 1, m.measurePoint || 'ขั้วหม้อแปลง',
    txNum_(m.ratedKva),
    txNum_(m.va), txNum_(m.vb), txNum_(m.vc), txNum_(m.vng),
    txNum_(m.vab), txNum_(m.vbc), txNum_(m.vca),
    merged.ia == null ? '' : txNum_(merged.ia), merged.ib == null ? '' : txNum_(merged.ib),
    merged.ic == null ? '' : txNum_(merged.ic), merged['in'] == null ? '' : txNum_(merged['in']),
    calc.kva, calc.loadPercent, calc.unbalance, calc.inPercent, calc.verdict,
    String(m.recommend || ''), String(m.note || ''), String(m.meterModel || ''),
    String(m.weather || ''), String(m.period || ''),
    m.lat != null ? m.lat : '', m.lon != null ? m.lon : '',
    String(m.address || ''), String(m.moo || ''), String(m.poleTag || ''),
    'ปกติ', now, changedByName]);

  if (feeders.length) {
    const fSheet = getOrCreatePatrolSheet_(SHEET_TXLOAD_FEEDER, TXLOAD_FEEDER_HEADERS);
    const rows = feeders.map(function (f, i) {
      return [loadId, txNum_(f.no) || (i + 1), String(f.name || ''),
              txNum_(f.ia), txNum_(f.ib), txNum_(f.ic), txNum_(f['in']),
              String(f.cableSize || ''), String(f.breakerSize || ''), String(f.note || '')];
    });
    fSheet.getRange(fSheet.getLastRow() + 1, 1, rows.length, TXLOAD_FEEDER_HEADERS.length).setValues(rows);
  }

  // จุดปลายสาย — วัดเฉพาะแรงดัน ไม่บังคับ จะมีกี่จุดก็ได้หรือไม่มีเลย
  if (ends.length) {
    const eSheet = getOrCreatePatrolSheet_(SHEET_TXLOAD_END, TXLOAD_END_HEADERS);
    const eRows = ends.map(function (e, i) {
      return [loadId, txNum_(e.no) || (i + 1), String(e.name || ''),
              e.feederNo === '' || e.feederNo == null ? '' : txNum_(e.feederNo),
              txNum_(e.va), txNum_(e.vb), txNum_(e.vc), txNum_(e.vng),
              txNum_(e.vab), txNum_(e.vbc), txNum_(e.vca),
              e.lat != null ? e.lat : '', e.lon != null ? e.lon : '',
              e.distanceM === '' || e.distanceM == null ? '' : txNum_(e.distanceM),
              e.dropPercent === '' || e.dropPercent == null ? '' : txNum_(e.dropPercent),
              String(e.note || '')];
    });
    eSheet.getRange(eSheet.getLastRow() + 1, 1, eRows.length, TXLOAD_END_HEADERS.length).setValues(eRows);
  }

  // รูปถ่าย — ถ้าอัปโหลดรูปใดล้มเหลว ผลการวัดที่บันทึกไว้แล้วยังอยู่ ส่งรายการที่พลาดกลับไปให้ลองใหม่เฉพาะรูปนั้น
  const photos = [];
  const failed = [];
  (Array.isArray(body.photos) ? body.photos : []).forEach(function (p) {
    if (!p || !p.base64) return;
    try {
      photos.push(txLoadUploadPhoto_(loadId, deviceId, p, changedByName));
    } catch (err) {
      failed.push({ kind: p.kind || 'extra', error: String(err) });
    }
  });

  txLoadStampDevice_(deviceId, measuredAt, calc);
  const plansTouched = txPlanMarkMeasured_(deviceId, loadId, measuredAt);
  logChange('วัดโหลดหม้อแปลง', String(m.feeder || ''), deviceId,
    [{ field: 'ผลการวัดโหลด', oldValue: '',
       newValue: calc.kva + ' kVA · ' + (calc.loadPercent == null ? '-' : calc.loadPercent + '%') + ' · ' + calc.verdict }],
    changedByName);

  return jsonOut({ ok: true, loadId: loadId, calc: calc, photos: photos,
                   plans: plansTouched.length ? plansTouched : undefined,
                   photoFailed: failed.length ? failed : undefined });
}

/** อัปโหลดรูป 1 รูปของการวัดโหลด แล้วบันทึกลงชีต TxLoadPhoto */
function txLoadUploadPhoto_(loadId, deviceId, photo, uploadedBy) {
  const kind = photo.kind || 'extra';   // pole | tank | meter | extra
  const folder = getTxLoadPhotoFolder_();
  const bytes = Utilities.base64Decode(photo.base64);
  const filename = deviceId + '_load_' + kind + '_' + new Date().getTime() + '.jpg';
  const file = folder.createFile(Utilities.newBlob(bytes, photo.mimeType || 'image/jpeg', filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const photoId = newPatrolId_('TP');
  getOrCreatePatrolSheet_(SHEET_TXLOAD_PHOTO, TXLOAD_PHOTO_HEADERS).appendRow([
    photoId, loadId, deviceId, kind, file.getId(), file.getUrl(),
    photo.takenAt || new Date(), photo.lat != null ? photo.lat : '', photo.lon != null ? photo.lon : '',
    uploadedBy, String(photo.caption || '')
  ]);
  return { photoId: photoId, url: file.getUrl(), fileId: file.getId(), kind: kind };
}

/** เขียนผลวัดล่าสุดลงชีต Devices คอลัมน์ X,Y — ทำให้รายการ/แผนที่แสดงสัญลักษณ์ได้เร็ว */
function txLoadStampDevice_(deviceId, measuredAt, calc) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
  if (!sheet) return;
  ensureTxLoadDeviceHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').trim() !== deviceId) continue;
    // เขียนทับเฉพาะเมื่อครั้งนี้ใหม่กว่าที่บันทึกไว้ (กันการส่งงานออฟไลน์ย้อนหลังมาทับของใหม่)
    const prev = values[i][DEV_COL_LASTLOAD_AT - 1];
    const prevTime = prev instanceof Date ? prev.getTime() : (prev ? new Date(prev).getTime() : 0);
    if (!isNaN(prevTime) && prevTime > measuredAt.getTime()) return;
    sheet.getRange(i + 1, DEV_COL_LASTLOAD_AT).setValue(measuredAt);
    sheet.getRange(i + 1, DEV_COL_LASTLOAD_PCT).setValue(calc.loadPercent == null ? '' : calc.loadPercent);
    sheet.getRange(i + 1, DEV_COL_LASTLOAD_KVA).setValue(calc.kva == null ? '' : calc.kva);
    sheet.getRange(i + 1, DEV_COL_LASTLOAD_VER).setValue(calc.verdict || '');
    return;
  }
}

/** ประวัติการวัดของหม้อแปลง 1 เครื่อง (ล่าสุดขึ้นก่อน) พร้อมวงจรย่อยและรูป */
function txLoadHistory_(body) {
  const deviceId = String(body.deviceId || '').trim();
  if (!deviceId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุหมายเลขหม้อแปลง' });
  const limit = Math.min(parseInt(body.limit, 10) || 10, 50);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXLOAD);
  if (!sheet) return jsonOut({ ok: true, deviceId: deviceId, records: [] });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });

  const records = [];
  for (let r = values.length - 1; r >= 1 && records.length < limit; r--) {
    if (String(values[r][1] || '').trim() !== deviceId) continue;
    if (String(values[r][headers.indexOf('Status')] || '').trim() === 'ลบแล้ว') continue;
    const rec = patrolRowToObj_(headers, values[r]);
    rec.row = r + 1;
    records.push(rec);
  }
  const ids = {};
  records.forEach(function (rec) { ids[rec.LoadID] = rec; rec.feeders = []; rec.ends = []; rec.photos = []; });

  const fSheet = ss.getSheetByName(SHEET_TXLOAD_FEEDER);
  if (fSheet) {
    const fv = fSheet.getDataRange().getValues();
    const fh = (fv[0] || []).map(function (h) { return String(h).trim(); });
    for (let r = 1; r < fv.length; r++) {
      const owner = ids[String(fv[r][0] || '').trim()];
      if (owner) owner.feeders.push(patrolRowToObj_(fh, fv[r]));
    }
  }
  const eSheet = ss.getSheetByName(SHEET_TXLOAD_END);
  if (eSheet) {
    const ev = eSheet.getDataRange().getValues();
    const eh = (ev[0] || []).map(function (h) { return String(h).trim(); });
    for (let r = 1; r < ev.length; r++) {
      const owner = ids[String(ev[r][0] || '').trim()];
      if (owner) owner.ends.push(patrolRowToObj_(eh, ev[r]));
    }
  }
  const pSheet = ss.getSheetByName(SHEET_TXLOAD_PHOTO);
  if (pSheet) {
    const pv = pSheet.getDataRange().getValues();
    const ph = (pv[0] || []).map(function (h) { return String(h).trim(); });
    for (let r = 1; r < pv.length; r++) {
      const owner = ids[String(pv[r][1] || '').trim()];
      if (owner) owner.photos.push(patrolRowToObj_(ph, pv[r]));
    }
  }
  return jsonOut({ ok: true, deviceId: deviceId, records: records });
}

/** รายการผลวัดทั้งหมด สำหรับหน้ารายงาน — กรองได้ด้วย verdict / ช่วงวันที่ */
function txLoadList_(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TXLOAD);
  if (!sheet) return jsonOut({ ok: true, rows: [] });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const wantVerdict = String(body.verdict || '').trim();
  const from = body.from ? new Date(body.from) : null;
  const to = body.to ? new Date(body.to) : null;
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const rec = patrolRowToObj_(headers, values[r]);
    if (!rec.LoadID) continue;
    if (rec.Status === 'ยกเลิก' || rec.Status === 'ลบแล้ว') continue;
    if (wantVerdict && rec.Verdict !== wantVerdict) continue;
    if (from || to) {
      const at = values[r][3] instanceof Date ? values[r][3] : new Date(values[r][3]);
      if (from && at < from) continue;
      if (to && at > to) continue;
    }
    rows.push(rec);
  }
  return jsonOut({ ok: true, rows: rows });
}

/** ยกเลิกผลวัด (ไม่ลบแถว เพื่อคงร่องรอย) — เจ้าของผลวัดหรือแอดมินเท่านั้น */
function txLoadCancel_(body, changedByName, requesterRole) {
  const loadId = String(body.loadId || '').trim();
  if (!loadId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสผลการวัด' });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TXLOAD);
  if (!sheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXLOAD });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const cOwner = headers.indexOf('MeasuredBy'), cStatus = headers.indexOf('Status');
  const cDev = headers.indexOf('DeviceID'), cFeeder = headers.indexOf('Feeder');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== loadId) continue;
    const owner = String(values[r][cOwner] || '').trim();
    if (requesterRole !== 'admin' && owner.toLowerCase() !== String(changedByName).trim().toLowerCase()) {
      return jsonOut({ ok: false, error: 'ยกเลิกได้เฉพาะผลวัดของตัวเอง หรือให้ผู้ดูแลระบบดำเนินการ' });
    }
    sheet.getRange(r + 1, cStatus + 1).setValue('ยกเลิก');
    sheet.getRange(r + 1, headers.indexOf('UpdatedAt') + 1).setValue(new Date());
    sheet.getRange(r + 1, headers.indexOf('UpdatedBy') + 1).setValue(changedByName);
    const deviceId = String(values[r][cDev] || '').trim();
    txLoadRestampDevice_(deviceId);
    txPlanUnmark_(loadId);
    logChange('ยกเลิกผลวัดโหลด', String(values[r][cFeeder] || ''), deviceId,
      [{ field: 'สถานะผลวัด', oldValue: 'ปกติ', newValue: 'ยกเลิก (' + loadId + ')' }], changedByName);
    return jsonOut({ ok: true, loadId: loadId });
  }
  return jsonOut({ ok: false, error: 'ไม่พบรหัสผลการวัด ' + loadId });
}

/** ลบผลวัดออกจากประวัติ — ผู้ดูแลระบบเท่านั้น
 *  ไม่ลบแถวจริง แต่ตั้ง Status เป็น 'ลบแล้ว' แถวยังอยู่ในชีตเพื่อคงร่องรอยว่าเคยมีการวัด
 *  รูปถ่ายในไดรฟ์ไม่ลบ แต่ต่อท้ายคำบรรยายไว้ว่าผลวัดถูกลบแล้ว จะได้รู้ตอนไปเปิดดูในไดรฟ์
 *  รับได้หลายรหัสในครั้งเดียว เพื่อให้เลือกลบทีละหลายรายการจากหน้าประวัติได้ */
function txLoadDelete_(body, changedByName, requesterRole) {
  if (requesterRole !== 'admin') {
    return jsonOut({ ok: false, error: 'ลบผลวัดได้เฉพาะผู้ดูแลระบบ — ผู้ใช้ทั่วไปกด "ยกเลิกผลวัด" แล้วแจ้งผู้ดูแลระบบให้ลบให้' });
  }
  const ids = (Array.isArray(body.loadIds) ? body.loadIds : [body.loadId])
    .map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return x; })
    .slice(0, 50);
  if (!ids.length) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสผลการวัด' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXLOAD);
  if (!sheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXLOAD });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const cStatus = headers.indexOf('Status'), cDev = headers.indexOf('DeviceID'),
        cFeeder = headers.indexOf('Feeder'), cAt = headers.indexOf('UpdatedAt'),
        cBy = headers.indexOf('UpdatedBy');
  const want = {};
  ids.forEach(function (x) { want[x] = true; });

  const done = [], devices = {};
  const now = new Date();
  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][0] || '').trim();
    if (!want[id]) continue;
    const prev = String(values[r][cStatus] || '').trim() || 'ปกติ';
    if (prev === 'ลบแล้ว') { done.push(id); continue; }
    sheet.getRange(r + 1, cStatus + 1).setValue('ลบแล้ว');
    sheet.getRange(r + 1, cAt + 1).setValue(now);
    sheet.getRange(r + 1, cBy + 1).setValue(changedByName);
    const deviceId = String(values[r][cDev] || '').trim();
    devices[deviceId] = String(values[r][cFeeder] || '');
    done.push(id);
    txPlanUnmark_(id);
    logChange('ลบผลวัดโหลดออกจากประวัติ', String(values[r][cFeeder] || ''), deviceId,
      [{ field: 'สถานะผลวัด', oldValue: prev, newValue: 'ลบแล้ว (' + id + ')' }], changedByName);
  }
  if (!done.length) return jsonOut({ ok: false, error: 'ไม่พบผลวัดที่ระบุ' });

  // ทำเครื่องหมายบนรูปว่าผลวัดถูกลบแล้ว — ไฟล์ยังอยู่ในไดรฟ์เหมือนเดิม
  let marked = 0;
  const pSheet = ss.getSheetByName(SHEET_TXLOAD_PHOTO);
  if (pSheet && pSheet.getLastRow() > 1) {
    const pv = pSheet.getDataRange().getValues();
    const ph = (pv[0] || []).map(function (h) { return String(h).trim(); });
    const cCap = ph.indexOf('Caption'), cLoad = 1;
    if (cCap >= 0) {
      const stamp = ' [ผลวัดถูกลบออกจากประวัติ ' + Utilities.formatDate(now, 'Asia/Bangkok', 'd/M/yyyy') +
                    ' โดย ' + changedByName + ']';
      for (let r2 = 1; r2 < pv.length; r2++) {
        if (!want[String(pv[r2][cLoad] || '').trim()]) continue;
        const cap = String(pv[r2][cCap] || '');
        if (cap.indexOf('ผลวัดถูกลบออกจากประวัติ') >= 0) continue;
        pSheet.getRange(r2 + 1, cCap + 1).setValue(cap + stamp);
        marked++;
      }
    }
  }

  Object.keys(devices).forEach(function (d) { if (d) txLoadRestampDevice_(d); });
  return jsonOut({ ok: true, deleted: done, count: done.length, photosMarked: marked });
}

/** คำนวณผลวัดล่าสุดของเครื่องนี้ใหม่จาก TxLoad แล้วเขียนลงชีต Devices — ใช้หลังยกเลิกผลวัด */
function txLoadRestampDevice_(deviceId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXLOAD);
  const dev = ss.getSheetByName(SHEET_DEVICES);
  if (!sheet || !dev) return;
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  const cAt = headers.indexOf('MeasuredAt'), cPct = headers.indexOf('LoadPercent'),
        cKva = headers.indexOf('KvaMeasured'), cVer = headers.indexOf('Verdict'),
        cStatus = headers.indexOf('Status');
  let bestAt = null, bestPct = '', bestKva = '', bestVer = '';
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][1] || '').trim() !== deviceId) continue;
    const st_ = String(values[r][cStatus] || '').trim();
    if (st_ === 'ยกเลิก' || st_ === 'ลบแล้ว') continue;
    const at = values[r][cAt] instanceof Date ? values[r][cAt] : new Date(values[r][cAt]);
    if (isNaN(at.getTime())) continue;
    if (!bestAt || at > bestAt) {
      bestAt = at; bestPct = values[r][cPct]; bestKva = values[r][cKva]; bestVer = values[r][cVer];
    }
  }
  ensureTxLoadDeviceHeaders_(dev);
  const dv = dev.getDataRange().getValues();
  for (let i = 1; i < dv.length; i++) {
    if (String(dv[i][1] || '').trim() !== deviceId) continue;
    dev.getRange(i + 1, DEV_COL_LASTLOAD_AT).setValue(bestAt || '');
    dev.getRange(i + 1, DEV_COL_LASTLOAD_PCT).setValue(bestAt ? bestPct : '');
    dev.getRange(i + 1, DEV_COL_LASTLOAD_KVA).setValue(bestAt ? bestKva : '');
    dev.getRange(i + 1, DEV_COL_LASTLOAD_VER).setValue(bestAt ? bestVer : '');
    return;
  }
}

/** ลบรูปของผลวัด (ทิ้งไฟล์ใน Drive ด้วย) — เจ้าของผลวัดหรือแอดมินเท่านั้น */
function txLoadPhotoDelete_(body, changedByName, requesterRole) {
  const photoId = String(body.photoId || '').trim();
  if (!photoId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสรูป' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pSheet = ss.getSheetByName(SHEET_TXLOAD_PHOTO);
  if (!pSheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXLOAD_PHOTO });
  const pv = pSheet.getDataRange().getValues();
  for (let r = 1; r < pv.length; r++) {
    if (String(pv[r][0] || '').trim() !== photoId) continue;
    const uploader = String(pv[r][9] || '').trim();
    if (requesterRole !== 'admin' && uploader.toLowerCase() !== String(changedByName).trim().toLowerCase()) {
      return jsonOut({ ok: false, error: 'ลบได้เฉพาะรูปที่ตัวเองอัปโหลด หรือให้ผู้ดูแลระบบดำเนินการ' });
    }
    try { DriveApp.getFileById(String(pv[r][4])).setTrashed(true); } catch (err) { /* ไฟล์อาจถูกลบไปแล้ว */ }
    pSheet.deleteRow(r + 1);
    logChange('ลบรูปผลวัดโหลด', '', String(pv[r][2] || ''),
      [{ field: 'รูป ' + String(pv[r][3] || ''), oldValue: photoId, newValue: 'ลบแล้ว' }], changedByName);
    return jsonOut({ ok: true, photoId: photoId });
  }
  return jsonOut({ ok: false, error: 'ไม่พบรหัสรูป ' + photoId });
}

/** เพิ่มรูปเข้าผลวัดที่บันทึกไว้แล้ว — ใช้เมื่ออัปโหลดรูปไม่สำเร็จตอนบันทึก หรืออยากเพิ่มทีหลัง */
function txLoadAddPhoto_(body, changedByName) {
  const loadId = String(body.loadId || '').trim();
  const deviceId = String(body.deviceId || '').trim();
  const photo = body.photo || {};
  if (!loadId || !photo.base64) return jsonOut({ ok: false, error: 'ข้อมูลรูปไม่ครบ' });
  try {
    const res = txLoadUploadPhoto_(loadId, deviceId, photo, changedByName);
    return jsonOut({ ok: true, photo: res });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** ===================== ตัวจ่ายงานของการวัดโหลด (เรียกจาก doPost) =====================
 * คืน null ถ้าไม่ใช่คำสั่ง txLoad (ให้ doPost ทำงานต่อตามปกติ)
 */
function handleTxLoadAction_(body, requesterRole, changedByName) {
  const action = body && body.action;
  if (!action || String(action).indexOf('txLoad') !== 0) return null;

  const WRITE_ACTIONS = ['txLoadSave', 'txLoadCancel', 'txLoadDelete', 'txLoadAddPhoto', 'txLoadPhotoDelete',
    'txLoadPlanCreate', 'txLoadPlanItemSet', 'txLoadPlanUpdate', 'txLoadPlanDelete'];
  if (WRITE_ACTIONS.indexOf(action) >= 0 && getUserApps_(changedByName, requesterRole).indexOf('tx-survey') < 0) {
    return jsonOut({ ok: false, error: 'บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งานโปรแกรมสำรวจหม้อแปลง กรุณาติดต่อผู้ดูแลระบบ' });
  }

  switch (action) {
    case 'txLoadBootstrap':   return txLoadBootstrap_();
    case 'txLoadSave':        return txLoadSave_(body, changedByName, requesterRole);
    case 'txLoadHistory':     return txLoadHistory_(body);
    case 'txLoadDelete':      return txLoadDelete_(body, changedByName, requesterRole);
    case 'txLoadList':        return txLoadList_(body);
    case 'txLoadCancel':      return txLoadCancel_(body, changedByName, requesterRole);
    case 'txLoadAddPhoto':    return txLoadAddPhoto_(body, changedByName);
    case 'txLoadPhotoDelete': return txLoadPhotoDelete_(body, changedByName, requesterRole);
    case 'txLoadPlanCreate':  return txPlanCreate_(body, changedByName);
    case 'txLoadPlanList':    return txPlanList_();
    case 'txLoadPlanDetail':  return txPlanDetail_(body);
    case 'txLoadPlanItemSet': return txPlanItemSet_(body, changedByName);
    case 'txLoadPlanUpdate':  return txPlanUpdate_(body, changedByName);
    case 'txLoadPlanDelete':  return txPlanDelete_(body, changedByName, requesterRole);
    default:
      return jsonOut({ ok: false, error: 'unknown txLoad action: ' + action });
  }
}

/* ==========================================================================
 *  แผนงานวัดโหลด (TxLoadPlan)  —  เพิ่มใหม่
 * --------------------------------------------------------------------------
 *  ไม่ได้วัดทุกเครื่อง จึงเลือกเป็นชุดไว้ก่อนว่ารอบนี้จะวัดเครื่องไหนบ้าง
 *  แล้วติดตามความคืบหน้าได้ว่าวัดไปกี่เครื่องจากกี่เครื่อง
 *    TxLoadPlan      1 แถว = 1 แผนงาน
 *    TxLoadPlanItem  1 แถว = หม้อแปลง 1 เครื่องในแผนนั้น
 *  เมื่อบันทึกผลวัด ระบบจะติ๊กรายการในแผนที่ยังค้างให้เป็น "วัดแล้ว" อัตโนมัติ
 * ========================================================================== */

const SHEET_TXPLAN      = 'TxLoadPlan';
const SHEET_TXPLAN_ITEM = 'TxLoadPlanItem';

const TXPLAN_HEADERS = ['PlanID', 'PlanName', 'CreatedAt', 'CreatedBy', 'AssignedTo', 'TargetMonth',
  'Criteria', 'Note', 'Status', 'UpdatedAt', 'UpdatedBy'];
const TXPLAN_ITEM_HEADERS = ['PlanID', 'DeviceID', 'Feeder', 'Status', 'LoadID', 'MeasuredAt',
  'SkipReason', 'AddedAt'];

const TXPLAN_ITEM_WAIT = 'รอวัด';
const TXPLAN_ITEM_DONE = 'วัดแล้ว';
const TXPLAN_ITEM_SKIP = 'ข้าม';

/** ตั้งค่าครั้งแรก — รันมือครั้งเดียว ปลอดภัย รันซ้ำได้ */
function txPlanSetup() {
  getOrCreatePatrolSheet_(SHEET_TXPLAN, TXPLAN_HEADERS);
  getOrCreatePatrolSheet_(SHEET_TXPLAN_ITEM, TXPLAN_ITEM_HEADERS);
  Logger.log('เตรียมชีตแผนงานวัดโหลดเรียบร้อย — TxLoadPlan / TxLoadPlanItem');
}

/** สร้างแผนใหม่พร้อมรายการหม้อแปลง (หน้าเว็บเป็นคนคัดรายชื่อมาให้แล้ว) */
function txPlanCreate_(body, changedByName) {
  const name = String(body.planName || '').trim();
  const ids = Array.isArray(body.deviceIds) ? body.deviceIds : [];
  if (!name) return jsonOut({ ok: false, error: 'ยังไม่ได้ตั้งชื่อแผนงาน' });
  if (!ids.length) return jsonOut({ ok: false, error: 'ยังไม่ได้เลือกหม้อแปลงเข้าแผน' });
  if (ids.length > 2000) return jsonOut({ ok: false, error: 'เลือกได้ไม่เกิน 2,000 เครื่องต่อแผน' });

  const planId = newPatrolId_('PL');
  const now = new Date();
  getOrCreatePatrolSheet_(SHEET_TXPLAN, TXPLAN_HEADERS).appendRow([
    planId, name, now, changedByName, String(body.assignedTo || ''), String(body.targetMonth || ''),
    String(body.criteria || ''), String(body.note || ''), 'เปิด', now, changedByName]);

  // หาวงจรของแต่ละเครื่องจากชีต Devices เพื่อเก็บไว้ในรายการ (ไม่ต้องอ่านซ้ำตอนแสดงผล)
  const devSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEVICES);
  const feederOf = {};
  if (devSheet) {
    const dv = devSheet.getDataRange().getValues();
    for (let i = 1; i < dv.length; i++) feederOf[String(dv[i][1] || '').trim()] = String(dv[i][0] || '').trim();
  }
  const seen = {};
  const rows = [];
  ids.forEach(function (raw) {
    const id = String(raw || '').trim();
    if (!id || seen[id]) return;      // กันรายชื่อซ้ำในแผนเดียวกัน
    seen[id] = true;
    rows.push([planId, id, feederOf[id] || '', TXPLAN_ITEM_WAIT, '', '', '', now]);
  });
  const itemSheet = getOrCreatePatrolSheet_(SHEET_TXPLAN_ITEM, TXPLAN_ITEM_HEADERS);
  if (rows.length) {
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, rows.length, TXPLAN_ITEM_HEADERS.length).setValues(rows);
  }
  logChange('สร้างแผนงานวัดโหลด', '', planId,
    [{ field: 'แผนงาน', oldValue: '', newValue: name + ' · ' + rows.length + ' เครื่อง' }], changedByName);
  return jsonOut({ ok: true, planId: planId, count: rows.length });
}

/** รายการแผนทั้งหมด พร้อมความคืบหน้า (นับจากชีตรายการ ไม่ต้องเก็บตัวเลขซ้ำ) */
function txPlanList_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXPLAN);
  if (!sheet) return jsonOut({ ok: true, plans: [] });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });

  const stat = {};
  const itemSheet = ss.getSheetByName(SHEET_TXPLAN_ITEM);
  if (itemSheet) {
    const iv = itemSheet.getDataRange().getValues();
    for (let r = 1; r < iv.length; r++) {
      const pid = String(iv[r][0] || '').trim();
      if (!pid) continue;
      if (!stat[pid]) stat[pid] = { total: 0, done: 0, skip: 0 };
      stat[pid].total++;
      const st = String(iv[r][3] || '').trim();
      if (st === TXPLAN_ITEM_DONE) stat[pid].done++;
      else if (st === TXPLAN_ITEM_SKIP) stat[pid].skip++;
    }
  }
  const plans = [];
  for (let r = 1; r < values.length; r++) {
    if (!String(values[r][0] || '').trim()) continue;
    const p = patrolRowToObj_(headers, values[r]);
    const s = stat[p.PlanID] || { total: 0, done: 0, skip: 0 };
    p.total = s.total; p.done = s.done; p.skip = s.skip;
    plans.push(p);
  }
  plans.reverse();   // แผนใหม่สุดขึ้นก่อน
  return jsonOut({ ok: true, plans: plans });
}

/** รายการหม้อแปลงในแผน 1 แผน */
function txPlanDetail_(body) {
  const planId = String(body.planId || '').trim();
  if (!planId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสแผนงาน' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXPLAN);
  let plan = null;
  if (sheet) {
    const values = sheet.getDataRange().getValues();
    const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0] || '').trim() === planId) { plan = patrolRowToObj_(headers, values[r]); break; }
    }
  }
  if (!plan) return jsonOut({ ok: false, error: 'ไม่พบแผนงาน ' + planId });

  const items = [];
  const itemSheet = ss.getSheetByName(SHEET_TXPLAN_ITEM);
  if (itemSheet) {
    const iv = itemSheet.getDataRange().getValues();
    const ih = (iv[0] || []).map(function (h) { return String(h).trim(); });
    for (let r = 1; r < iv.length; r++) {
      if (String(iv[r][0] || '').trim() !== planId) continue;
      const it = patrolRowToObj_(ih, iv[r]);
      it.row = r + 1;
      items.push(it);
    }
  }
  return jsonOut({ ok: true, plan: plan, items: items });
}

/** แก้รายการในแผน — ข้าม (พร้อมเหตุผล) หรือกลับมารอวัดใหม่ */
function txPlanItemSet_(body, changedByName) {
  const planId = String(body.planId || '').trim();
  const deviceId = String(body.deviceId || '').trim();
  const status = String(body.status || '').trim();
  if (!planId || !deviceId) return jsonOut({ ok: false, error: 'ข้อมูลไม่ครบ' });
  if ([TXPLAN_ITEM_WAIT, TXPLAN_ITEM_SKIP].indexOf(status) < 0) {
    return jsonOut({ ok: false, error: 'สถานะไม่ถูกต้อง (ตั้งเป็น "วัดแล้ว" เองไม่ได้ ต้องบันทึกผลวัดจริง)' });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TXPLAN_ITEM);
  if (!sheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXPLAN_ITEM });
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== planId) continue;
    if (String(values[r][1] || '').trim() !== deviceId) continue;
    if (String(values[r][3] || '').trim() === TXPLAN_ITEM_DONE) {
      return jsonOut({ ok: false, error: 'เครื่องนี้วัดไปแล้ว ถ้าต้องการแก้ให้ยกเลิกผลวัดก่อน' });
    }
    sheet.getRange(r + 1, 4).setValue(status);
    sheet.getRange(r + 1, 7).setValue(status === TXPLAN_ITEM_SKIP ? String(body.skipReason || '') : '');
    logChange('แก้รายการในแผนวัดโหลด', String(values[r][2] || ''), deviceId,
      [{ field: 'สถานะในแผน ' + planId, oldValue: String(values[r][3] || ''), newValue: status }], changedByName);
    return jsonOut({ ok: true });
  }
  return jsonOut({ ok: false, error: 'ไม่พบหม้อแปลง ' + deviceId + ' ในแผนนี้' });
}

/** ปิด/เปิดแผน หรือแก้ชื่อ-ผู้รับผิดชอบ-หมายเหตุ */
function txPlanUpdate_(body, changedByName) {
  const planId = String(body.planId || '').trim();
  if (!planId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสแผนงาน' });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TXPLAN);
  if (!sheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXPLAN });
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== planId) continue;
    const set = function (col, v) { if (v != null) sheet.getRange(r + 1, headers.indexOf(col) + 1).setValue(v); };
    if (body.planName)   set('PlanName', String(body.planName));
    if (body.assignedTo != null) set('AssignedTo', String(body.assignedTo));
    if (body.targetMonth != null) set('TargetMonth', String(body.targetMonth));
    if (body.note != null) set('Note', String(body.note));
    if (body.status && ['เปิด', 'ปิด'].indexOf(String(body.status)) >= 0) set('Status', String(body.status));
    set('UpdatedAt', new Date());
    set('UpdatedBy', changedByName);
    logChange('แก้แผนงานวัดโหลด', '', planId,
      [{ field: 'แผนงาน', oldValue: String(values[r][1] || ''), newValue: String(body.planName || values[r][1] || '') +
        (body.status ? ' · ' + body.status : '') }], changedByName);
    return jsonOut({ ok: true });
  }
  return jsonOut({ ok: false, error: 'ไม่พบแผนงาน ' + planId });
}

/** ลบแผนทั้งแผน (รวมรายการในแผน) — ผลวัดที่บันทึกไว้แล้วไม่ถูกแตะ */
function txPlanDelete_(body, changedByName, requesterRole) {
  const planId = String(body.planId || '').trim();
  if (!planId) return jsonOut({ ok: false, error: 'ไม่ได้ระบุรหัสแผนงาน' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TXPLAN);
  if (!sheet) return jsonOut({ ok: false, error: 'ยังไม่มีชีต ' + SHEET_TXPLAN });
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== planId) continue;
    const owner = String(values[r][3] || '').trim();
    if (requesterRole !== 'admin' && owner.toLowerCase() !== String(changedByName).trim().toLowerCase()) {
      return jsonOut({ ok: false, error: 'ลบได้เฉพาะแผนที่ตัวเองสร้าง หรือให้ผู้ดูแลระบบดำเนินการ' });
    }
    const planName = String(values[r][1] || '');
    sheet.deleteRow(r + 1);
    const itemSheet = ss.getSheetByName(SHEET_TXPLAN_ITEM);
    if (itemSheet) {
      const iv = itemSheet.getDataRange().getValues();
      for (let i = iv.length - 1; i >= 1; i--) {
        if (String(iv[i][0] || '').trim() === planId) itemSheet.deleteRow(i + 1);
      }
    }
    logChange('ลบแผนงานวัดโหลด', '', planId,
      [{ field: 'แผนงาน', oldValue: planName, newValue: 'ลบแล้ว' }], changedByName);
    return jsonOut({ ok: true });
  }
  return jsonOut({ ok: false, error: 'ไม่พบแผนงาน ' + planId });
}

/**
 * ติ๊กรายการในแผนให้เป็น "วัดแล้ว" หลังบันทึกผลวัด
 * ทำกับทุกแผนที่ยังเปิดอยู่และมีเครื่องนี้ค้างอยู่ — เครื่องเดียวอาจอยู่ในหลายแผน
 * คืนรายชื่อแผนที่ถูกติ๊ก เพื่อให้หน้าเว็บรู้ว่าจะเสนอเครื่องถัดไปจากแผนไหน
 */
function txPlanMarkMeasured_(deviceId, loadId, measuredAt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const itemSheet = ss.getSheetByName(SHEET_TXPLAN_ITEM);
  if (!itemSheet) return [];
  const openPlans = {};
  const planSheet = ss.getSheetByName(SHEET_TXPLAN);
  if (planSheet) {
    const pv = planSheet.getDataRange().getValues();
    for (let r = 1; r < pv.length; r++) {
      if (String(pv[r][8] || '').trim() !== 'ปิด') openPlans[String(pv[r][0] || '').trim()] = String(pv[r][1] || '');
    }
  }
  const touched = [];
  const iv = itemSheet.getDataRange().getValues();
  for (let r = 1; r < iv.length; r++) {
    if (String(iv[r][1] || '').trim() !== deviceId) continue;
    if (String(iv[r][3] || '').trim() === TXPLAN_ITEM_DONE) continue;
    const pid = String(iv[r][0] || '').trim();
    if (!openPlans.hasOwnProperty(pid)) continue;
    itemSheet.getRange(r + 1, 4).setValue(TXPLAN_ITEM_DONE);
    itemSheet.getRange(r + 1, 5).setValue(loadId);
    itemSheet.getRange(r + 1, 6).setValue(measuredAt);
    touched.push({ planId: pid, planName: openPlans[pid] });
  }
  return touched;
}

/** ยกเลิกผลวัด → รายการในแผนกลับมาเป็น "รอวัด" */
function txPlanUnmark_(loadId) {
  const itemSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TXPLAN_ITEM);
  if (!itemSheet || !loadId) return;
  const iv = itemSheet.getDataRange().getValues();
  for (let r = 1; r < iv.length; r++) {
    if (String(iv[r][4] || '').trim() !== loadId) continue;
    itemSheet.getRange(r + 1, 4).setValue(TXPLAN_ITEM_WAIT);
    itemSheet.getRange(r + 1, 5).setValue('');
    itemSheet.getRange(r + 1, 6).setValue('');
  }
}
