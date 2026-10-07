# แหล่งเนื้อเพลงไทยแบบ time-synced (LRC) สำหรับ Spotify-Lyrics-fork

- วันที่วิจัย: 2026-10-07 · branch `feat/thai-lyrics-source`
- ขอบเขต: (1) วัด coverage เพลงไทยของแหล่งปัจจุบัน (LRCLIB, NetEase) แบบ empirical (2) สำรวจแหล่งทางเลือกที่อาจมีเนื้อไทยพร้อม timestamp รายบรรทัด
- ไฟล์นี้ **ไม่มีเนื้อเพลง** เลย รายงานเฉพาะจำนวนบรรทัด, flag และการมี/ไม่มี timestamp

## สรุป

1. ทดสอบ 26 เพลงไทย (17 เพลงจากชาร์ต Spotify Thailand รายสัปดาห์ 2026-10-01 และเพลงเก่า 9 เพลง) พบว่า LRCLIB มี synced 23/26 (88%), NetEase มี 22/26 (85%) และมีอย่างน้อยหนึ่งแหล่ง 24/26 (92%) ส่วนเพลงในชาร์ตครบ 17/17
2. เมื่อรัน pipeline จริงของ extension (ค่า default) จะได้เนื้อไทยแบบ synced 22/26 (85%) ที่ตกหล่นเป็นปัญหา matching ไม่ใช่เพราะไม่มีข้อมูล: (ก) ชื่อศิลปินในฐานข้อมูลเป็นอักษรไทยแต่ query เป็นอักษรละติน (ข) NetEase บาง entry มีแต่บรรทัด credit แต่ extension นับว่า "เจอเนื้อ" จึงไม่ fallback
3. ช่องว่างจริงอยู่ที่เพลงเก่า/ลูกทุ่ง: 2/9 เพลงมีแต่เนื้อแบบไม่มีเวลา (plain) ในทั้งสองแหล่ง
4. แหล่งอื่นที่มีเนื้อไทยแบบ synced จริง ได้แก่ Spotify/Musixmatch, Apple Music และ JOOX ทุกแหล่งต้องใช้ token ของผู้ใช้ ต้องจ่ายเงิน หรือขัด ToS (ห้ามคัดลอก ห้าม scrape) ส่วน Musixmatch API ทางการมี synced ตั้งแต่ plan Grow ($199/เดือน) และห้ามใช้แบบ karaoke
5. เว็บเนื้อเพลงไทย (เช่น Siamzone) มีแต่ plain text ส่วน LRC repo (Megalobiz, Lyricsify) มีเพลงไทยบ้าง แต่เป็นงานที่ผู้ใช้ทำเองและสิทธิ์ไม่ชัด

---

## 1. วิธีการ (Methodology)

### 1.1 สิ่งที่ extension ทำอยู่ตอนนี้ (อ่านจากโค้ด)

| จุด | พฤติกรรม | อ้างอิง |
|---|---|---|
| LRCLIB | `GET /api/search?q=...` แล้วเก็บเฉพาะผลที่มี `syncedLyrics` ส่วน `GET /api/get/{id}` ใช้ดึงเนื้อ | [`src/page/lrclib.ts#L22-L48`](../../src/page/lrclib.ts#L22-L48), filter ที่ [L29](../../src/page/lrclib.ts#L29) |
| NetEase | `search?keywords=...&type=1&limit=100` (โค้ดจริงใช้ `limit=100` ไม่ใช่ 30) แล้วอ่านฟิลด์ `lrc.lyric` จาก `lyric?id=` ผ่าน proxy `files.xianqiao.wang` | [`src/page/netease.ts#L57-L76`](../../src/page/netease.ts#L57-L76), [`src/page/config.json#L2`](../../src/page/config.json#L2) |
| ลำดับแหล่ง | default คือ LRCLIB ([`src/options/store.ts#L21`](../../src/options/store.ts#L21)) ถ้าแหล่งหลักไม่มีเนื้อหรือไม่มีผล จะลองแหล่งที่สอง แล้วสุดท้ายลอง Spotify built-in | [`src/page/share-data.ts#L195-L198`](../../src/page/share-data.ts#L195-L198), [L263-L276](../../src/page/share-data.ts#L263-L276) |
| Matching | ให้คะแนนชื่อเพลง (สูงสุด 10), ศิลปิน (สูงสุด 6) และ duration (10 คะแนนถ้าต่างกันไม่ถึง 2 วินาที หรือไม่รู้ duration) แล้วเลือก candidate เฉพาะเมื่อคะแนน **> 20** | [`src/page/lyrics.ts#L162-L169`](../../src/page/lyrics.ts#L162-L169), [L268](../../src/page/lyrics.ts#L268) |
| บรรทัดไม่มี timestamp | ถูกทิ้ง ยกเว้นใน editor ที่ใช้ `keepPlainText` | [`src/page/lyrics.ts#L373`](../../src/page/lyrics.ts#L373), [`src/page/editor/app.ts#L22`](../../src/page/editor/app.ts#L22) |
| ตัวกรอง credit (`clean-lyrics`) | รู้จักแต่คำภาษาจีน/อังกฤษ เช่น 作词, 作曲 ไม่มีคำไทย (คำร้อง/ทำนอง) และไม่มี 人声 | [`src/page/lyrics.ts#L349-L355`](../../src/page/lyrics.ts#L349-L355) |
| Spotify built-in | ดักจับ `/metadata/4/track/` แล้วเรียก `color-lyrics/v2` ด้วย header ของหน้าเว็บเอง และใช้เฉพาะ `LINE_SYNCED` | [`src/page/observer.ts#L138-L170`](../../src/page/observer.ts#L138-L170) |

### 1.2 ตัวอย่างเพลง (sample)

- **เพลงปัจจุบัน 17 เพลง**: ชื่อเพลงอักษรไทย 17 เพลงแรกตามลำดับของ [kworb: Spotify Weekly Chart - Thailand](https://kworb.net/spotify/country/th_weekly.html) (ชาร์ตวันที่ 2026/10/01 อันดับ 1–28) ไม่ได้เลือกเอง ชื่อศิลปินและ Spotify track id มาจากลิงก์ของ kworb ส่วน kworb เขียน featured artist เป็น "(w/ …)" ซึ่งแปลงกลับเป็นรายชื่อศิลปินแล้ว
- **เพลงเก่า 9 เพลง** (เลือกเองให้ครอบคลุมหลายแนว): pop ปี 1986, เพื่อชีวิต, rock, indie 2 เพลง, pop-rock, ลูกทุ่ง 2 เพลง และลูกทุ่ง/หมอลำ ชื่อเพลง ศิลปิน และปีตรวจกับ [iTunes Search API](https://performance-partners.apple.com/search-api) (`country=th`) และถ้ามีก็ตรวจกับ [kworb TH weekly totals](https://kworb.net/spotify/country/th_weekly_totals.html) ซึ่งให้ชื่อตามที่ Spotify แสดง
- **ความยาวเพลง**: ใช้ `trackTimeMillis` จาก iTunes Search API แทนความยาวบน Spotify ไม่ได้เก็บความยาวจาก Spotify เพราะ [Spotify User Guidelines](https://www.spotify.com/us/legal/user-guidelines/) ห้าม crawling/scraping มี 2 เพลงที่ไม่มีใน Apple TH (Z9 "ไม่รักดีกว่า" และ PROXIE "ขี้แง" ต้นฉบับ ซึ่ง Apple มีแต่เวอร์ชัน live session) จึงไม่รู้ความยาว
- **ยังไม่ได้ยืนยัน**: ชื่อศิลปินที่ Spotify แสดงสำหรับ Phumphuang Duangchan และ Tai Orathai (ใช้ชื่อจาก Apple) ส่วน Bird Thongchai และ Carabao อนุมานจาก kworb ที่แสดงชื่อนี้กับเพลงอื่นของศิลปินเดียวกัน

### 1.3 การ query

ทุกอย่างอยู่ใน scratchpad ไม่ได้ใส่ใน repo (`…/scratchpad/thai-research/`: `build_songs.py`, `patch_songs.py`, `http_cache.mjs`, `query_sources.mjs`, `ext-run/replay.spec.ts`, `summarize.py`)

- **LRCLIB**: เรียกเพลงละ 6 ครั้ง ได้แก่ `search?q=<ศิลปิน> <ชื่อเพลง>`, `search?q=<ชื่อเพลง>`, `search?q=<ศิลปิน> <ชื่อเพลงส่วนภาษาไทย>` (ถ้ามีวงเล็บ), `search?track_name=&artist_name=`, `search?q=<ศิลปิน>` (ไว้หาชื่อ romanized) และ `get?track_name=&artist_name=`
- **NetEase**: ใช้ URL เดียวกับ extension (ผ่าน proxy) เรียก search เพลงละ 4 ครั้ง (`limit=100`) แล้วดึง `lyric?id=` ให้ candidate ที่น่าจะใช่ อย่างมาก 5 ตัว
- **มารยาทในการเรียก**: เรียกทีละ request ต่อ host เว้นอย่างน้อย 1.1 วินาที ถ้าได้ 503/429 จะรอตาม `Retry-After` แล้ว retry และใส่ `User-Agent` ตามที่ [LRCLIB API docs](https://lrclib.net/docs) กำหนด ผลทุก request ถูก cache ไว้ รวม 404 request (LRCLIB 192, NetEase proxy 212)

### 1.4 เกณฑ์จัดประเภท (ต่อแหล่ง ต่อเพลง)

- **ชื่อเพลงตรง**: ตรงกันหลัง normalize (ตัดวงเล็บ feat, เว้นวรรค, เครื่องหมาย) หรือมีชื่อส่วนภาษาไทยอยู่ในชื่อ (เฉพาะชื่อยาวอย่างน้อย 4 ตัวอักษร เพราะคำสั้นอย่าง "ขอ" ไปอยู่ในคำอื่นได้ง่าย) หรือตรงกับชื่อภาษาอังกฤษในวงเล็บ (flag ไว้)
- **ศิลปินตรง**: ตรงกับชื่อที่ Spotify แสดง หรือตรงกับชื่อสะกดแบบอื่นของศิลปินคนเดียวกัน เช่น "ต่าย อรทัย" ↔ "Tai Orathai" (flag ไว้)
- **`synced`**: มีบรรทัดเนื้อที่มี timestamp อย่างน้อย 5 บรรทัด (ไม่นับบรรทัด credit) และครอบคลุมเวลาอย่างน้อย 30 วินาที
- **`plain only`**: เจอเพลงที่ตรง มีเนื้ออย่างน้อย 5 บรรทัด แต่ไม่มี timestamp
- **`no lyrics`**: เจอเพลงที่ตรง แต่เนื้อว่าง หรือมีแต่บรรทัด credit (เช่น 作词/作曲) ไม่ถึง 5 บรรทัด
- **`not found`** / **`error`**: ไม่เจอเพลงที่ตรง / request ล้มเหลว (ไม่มีกรณี error)
- ถ้ามีหลาย entry จะเลือกตัวที่ศิลปินตรงกับชื่อบน Spotify ก่อน แล้วจึงเลือกตัวที่ความยาวใกล้ที่สุด entry ที่เป็น live/remix/cover จะถูก flag และไม่นับเป็นเวอร์ชันหลัก

### 1.5 Replay pipeline จริงของ extension

นอกจากถามว่าแหล่งข้อมูลมีเนื้อไหม ยังรัน **โค้ดจริงของ repo** (`matchingLyrics`, `fetchLyric`, `parseLyrics`, `fetchLRCLIBSongList`, `fetchNetEaseSongList`) ด้วย vitest + happy-dom โดย mock เฉพาะ `request` ให้ไปใช้ fetcher ที่ cache และเว้นระยะเหมือนกัน แล้วทำตามลำดับ default ของ `share-data.ts` คือ LRCLIB ก่อน แล้ว fallback ไป NetEase โดย**ไม่รวม** community store (`getSong`) และ Spotify built-in รันสองแบบ คือส่งความยาวจาก Apple และแบบไม่รู้ความยาว นับว่า "ได้เนื้อจริง" เมื่อมีบรรทัดที่มีเวลาอย่างน้อย 5 บรรทัดและเป็นอักษรไทยอย่างน้อย 3 บรรทัด

---

## 2. ผลการวัด coverage

### 2.1 รายเพลง

ความยาวมาจาก Apple TH ส่วน Δ คือผลต่างความยาวระหว่าง entry ที่เลือกกับความยาวจาก Apple

| # | เพลง — ศิลปิน (ชื่อบน Spotify) | กลุ่ม | ความยาว | LRCLIB | NetEase | Extension replay |
|---|---|---|---|---|---|---|
| 1 | ขึ้นใจ (3am call) — Mirrr, BLVCKHEART | chart #1 | 4:22 | synced (74 บรรทัด, Δ0) | synced (79, Δ0) | ✅ LRCLIB |
| 2 | เมื่อไหร่จะมี (มีใจให้กัน) — BLVCKHEART | chart #2 | 3:35 | synced (56, Δ0) | synced (58, Δ0) ¹ | ✅ LRCLIB |
| 3 | ไม่รักดีกว่า — Z9 | chart #3 | ? | synced (53) | synced (49) | ✅ LRCLIB |
| 4 | กลัวว่าฉันจะไม่เสียใจ (Fear) — PURPEECH | chart #4 | 4:47 | synced (37, Δ0) | synced (30, Δ0) | ✅ LRCLIB |
| 5 | ได้แค่เดินมาส่ง (The Last Walk) — GAVIN:D, BLVCKHEART | chart #7 | 3:48 | synced (40, Δ0) | synced (42, Δ0) | ✅ LRCLIB |
| 6 | นาฬิกาทราย (sign) — BOWKYLION | chart #8 | 4:15 | synced (51, Δ0) | synced (51, Δ0) | ✅ LRCLIB |
| 7 | รักให้เธอได้รู้ (Proof.) — PUN | chart #10 | 3:22 | synced (40, Δ0) | synced (48, Δ0) | ✅ LRCLIB |
| 8 | จากกันโดยสมบูรณ์ — guncharlie | chart #14 | 3:26 | synced (27, Δ0) | synced (26, Δ0) | ✅ LRCLIB |
| 9 | ขี้แง (Boys Don't Cry) — PROXIE | chart #15 | ? | synced (73) | synced (73) | ✅ LRCLIB |
| 10 | ฝากให้เขารัก — Yes'sir Days | chart #16 | 4:17 | synced (29, Δ0) | synced (42, Δ0) | ✅ LRCLIB |
| 11 | ที่คั่นหนังสือ (Sometimes) — BOWKYLION, NONT TANONT | chart #18 | 4:52 | synced (44, Δ0) | synced (44, Δ+1) | ✅ LRCLIB |
| 12 | 9 นาฬิกา — SPF | chart #19 | 4:02 | synced (33, Δ0) | synced (44, Δ0) | ✅ LRCLIB |
| 13 | สายไป — 9tokyo, BLVCKHEART | chart #20 | 3:18 | synced (42, Δ0) | no lyrics (มีแต่ credit) | ✅ LRCLIB |
| 14 | ดาวตก (Wish) — WANYAi, Z9 | chart #24 | 4:01 | synced (59, Δ0) | synced (59, Δ0) | ✅ LRCLIB |
| 15 | ขอแค่นี้ (Forever n ever) — PUN | chart #25 | 3:39 | synced (59, Δ0) | synced (66, Δ0) | ✅ LRCLIB |
| 16 | ขอ (WARM EYES) — Lomosonic | chart #27 | 5:56 | plain only (3 entry) | synced ² | ❌ แสดง credit 1 บรรทัด ² |
| 17 | ซาโยนาระ — Mild | chart #28 | 4:54 | synced (71, Δ0) | synced (43, Δ0) | ✅ LRCLIB |
| 18 | ฝากฟ้าทะเลฝัน — Bird Thongchai | เก่า · pop 1986 | 3:34 | synced (25, Δ+1) ³ | synced (27, Δ0) | ✅ LRCLIB |
| 19 | เมดอินไทยแลนด์ — Carabao | เก่า · เพื่อชีวิต | 3:06 ⁴ | plain only ⁴ | plain only ⁴ | ❌ ไม่มีเนื้อ |
| 20 | ขี้หึง — Silly Fools | เก่า · rock 2002 | 4:26 | synced (54, Δ0) | synced (52, Δ0) | ✅ LRCLIB |
| 21 | กระแซะเข้ามาซิ — Phumphuang Duangchan * | เก่า · ลูกทุ่ง | 3:01 | plain only ⁵ | no lyrics ⁵ | ❌ ไม่มีเนื้อ |
| 22 | ดอกหญ้าในป่าปูน — Tai Orathai * | เก่า · ลูกทุ่ง 2002 | 3:49 | synced (40, Δ0) ⁶ | no lyrics (มีแต่ credit) | ❌ แสดง credit 1 บรรทัด ⁶ |
| 23 | ทุกอย่าง — SCRUBB | เก่า · indie 2003 | 4:16 | synced (31, Δ0) | synced (22, Δ0) | ✅ LRCLIB |
| 24 | เวลาเธอยิ้ม — Polycat | เก่า · indie 2014 | 3:47 | synced (51, Δ0) | synced (47, Δ0) | ✅ LRCLIB |
| 25 | คิดถึงฉันไหมเวลาที่เธอ... — Taxi | เก่า · pop-rock 2003 | 4:25 | synced (76, Δ0) | synced (54, Δ0) | ✅ LRCLIB |
| 26 | ผู้สาวขาเลาะ — ลำไย ไหทองคำ | เก่า · ลูกทุ่ง/หมอลำ 2016 | 3:23 | synced (47, Δ0) | synced (47, Δ0) ⁷ | ✅ LRCLIB |

\* ยังไม่ได้ยืนยันว่า Spotify แสดงชื่อศิลปินนี้ (ใช้ชื่อจาก Apple Music)

1. NetEase: entry เวอร์ชันหลัก (ความยาวตรง) ลงชื่อศิลปินเป็น "Blackheart" ส่วน entry ที่สะกด "BLVCKHEART" ตรงเป็นเวอร์ชัน "Miss Call Ver." (สั้นกว่า 16 วินาที)
2. NetEase มี 3 entry: "ขอ (WARM EYES)" (ชื่อและความยาวตรงทุกอย่าง) มีแต่บรรทัด credit 作词/作曲/人声, "ขอ" (Δ−2 วินาที) synced และ "Khor" (ชื่อ romanized) synced ส่วน extension เลือก entry แรกเพราะชื่อตรงที่สุด จึงแสดงบรรทัด 人声 (credit นักร้อง) บรรทัดเดียว
3. LRCLIB: entry ศิลปิน "Bird Thongchai" ที่ synced มีชื่อเพลงต่อท้ายว่า "(หาดทราย สายลม สองเรา)" ส่วน entry ชื่อตรงเป๊ะที่ `/api/get` คืนมาเป็น plain only และมี entry synced อีกตัวที่ลงชื่อศิลปิน "เบิร์ด ธงไชย"
4. ความยาว 3:06 ของ Apple มาจากอัลบั้มรวมเพลงปี 1996 ส่วนในทั้งสองแหล่ง entry ชื่อไทยยาวประมาณ 4:10 และเป็น plain ไม่มีเวลา LRCLIB ลงชื่อศิลปินว่า "คาราบาว" และ entry "Made in Thailand" ของ NetEase (3:07) มีแต่ข้อความภาษาจีนไม่กี่บรรทัดใน 8 วินาทีแรก ไม่ใช่เนื้อเพลง
5. ทั้งสองแหล่งลงชื่อศิลปินเป็น "พุ่มพวง ดวงจันทร์" LRCLIB มีเฉพาะ plain สำหรับเวอร์ชันของพุ่มพวง ส่วน entry ที่ synced เป็นเวอร์ชัน cover ของศิลปินอื่น (หลิว อาจารียา, เปาวลี พรพิมล) ส่วน NetEase มีแต่ credit
6. LRCLIB มี synced (4 entry ซ้ำกัน, Δ0) แต่ลงชื่อศิลปินว่า "ต่าย อรทัย" เท่านั้น extension ค้นด้วย "Tai Orathai" จึงได้คะแนน 20 (ชื่อเพลง 10 + ความยาว 10 + ศิลปิน 0) ซึ่งไม่ผ่านเกณฑ์ > 20 แล้วไป fallback ที่ entry ของ NetEase ซึ่งมีแต่ credit
7. NetEase ลงชื่อศิลปินว่า "Lamyai Haithongkham" แต่ LRCLIB สะกดตรงกับ Spotify

### 2.2 ยอดรวม

| | LRCLIB synced | NetEase synced | มีในแหล่งใดแหล่งหนึ่ง | Extension replay ได้เนื้อไทยจริง |
|---|---|---|---|---|
| **ทั้งหมด (26)** | **23 (88%)** | **22 (85%)** | **24 (92%)** | **22 (85%)** |
| chart ปัจจุบัน (17) | 16 (94%) | 16 (94%) | 17 (100%) | 16 (94%) |
| เพลงเก่า (9) | 7 (78%) | 6 (67%) | 7 (78%) | 6 (67%) |
| แบบเข้มงวด: ไม่นับ match ที่ศิลปินตรงแค่ชื่อสะกดแบบอื่น (26) | 22 (85%) | 20 (77%) | 23 (88%) | – |

- Replay ทั้งสองแบบ (ใช้ความยาวจาก Apple / ไม่รู้ความยาว) ได้ผล "แสดงหรือไม่แสดง" ตรงกันครบทั้ง 26 เพลง
- LRCLIB `/api/get?track_name=&artist_name=` (ไม่ส่ง album/duration) ได้ 200 จำนวน 23/26 แต่ entry ที่คืนมามี synced แค่ 20/26 เพราะบางครั้งคืน entry ซ้ำที่เป็น plain ทั้งที่มี entry synced อยู่ (#18, #23) ส่วน extension ใช้ `/search` จึงไม่โดนปัญหานี้
- ระหว่างวัด LRCLIB ตอบ `503` ไป 50 จาก 192 request (ต้อง retry อย่างน้อยหนึ่งครั้ง) แต่สุดท้ายได้ผลครบ ส่วน NetEase proxy ไม่มี error

### 2.3 ข้อสังเกตจากข้อมูล

- **เพลงปัจจุบันมีครบเกือบทุกเพลงในทั้งสองแหล่ง** และมักมีหลาย entry ซ้ำกัน ศิลปินบางรายใน LRCLIB ใช้ชื่อแบบ "GAVIN D. - Topic" (รูปแบบชื่อช่องอัตโนมัติของ YouTube) แปลว่ามีผู้ใช้ทั่วไป upload เพลงไทยเข้า LRCLIB อยู่ (นี่เป็นข้อสังเกตจากข้อมูล ไม่ได้ยืนยันว่าใคร upload)
- **ปัญหาชื่อศิลปินคนละอักษร (ไทย ↔ ละติน)** พบใน 5 เพลง (#2, #18, #21, #22, #26) โดยเฉพาะศิลปินลูกทุ่งและศิลปินรุ่นเก่า แต่ตาราง alias ของ extension (`SINGER` ใน `config.json` และการค้นชื่อศิลปินผ่าน NetEase) ออกแบบมาสำหรับชื่อจีน/ญี่ปุ่น/เกาหลี
- **NetEase มี entry ที่มีแต่ credit** (`lrc.lyric` มีแค่ 作词/作曲/人声) ใน #13, #16, #21 และ #22 ซึ่ง `parseLyrics` ยังคืนค่าไม่เป็น null (เหลือบรรทัด 人声 ที่ตัวกรองไม่รู้จัก) extension จึงไม่ fallback และไม่ลอง candidate ถัดไป
- **ชื่อ romanized**: NetEase มีบาง entry ซ้ำในชื่อ romanized/อังกฤษ เช่น "Khor", "Thuk Yang (Everything)", "Made in Thailand" แต่ใน sample นี้**ไม่มีเพลงไหนที่หาได้เฉพาะในชื่อ romanized** ส่วน LRCLIB ไม่พบกรณีแบบนี้
- **ความยาว**: entry ที่ match ส่วนใหญ่มีความยาวต่างจาก Apple ไม่เกิน ±2 วินาที ยกเว้นเพลงที่ Apple ใช้เวอร์ชันอัลบั้มรวมเพลง (#19)

---

## 3. เปรียบเทียบแหล่งทางเลือก

ความเสี่ยงด้าน ToS เป็นการอ่านจากเงื่อนไขที่เผยแพร่ ไม่ใช่ความเห็นทางกฎหมาย

| แหล่ง | Thai coverage (หลักฐาน) | timing รายบรรทัด | ช่องทาง | Auth | ToS / ความเสี่ยงทางกฎหมาย | ความเสถียร |
|---|---|---|---|---|---|---|
| **LRCLIB** (ปัจจุบัน) | วัดได้ 23/26 (หัวข้อ 2) | มี | API สาธารณะ ([docs](https://lrclib.net/docs)) | ไม่ต้องใช้ key แต่ต้องระบุ client ผ่าน `User-Agent`/`Lrclib-Client` | เปิดให้ใช้ แต่ต้องเคารพ 429/`Retry-After` ([docs](https://lrclib.net/docs)) ส่วนสิทธิ์ของเนื้อเพลงที่ผู้ใช้ upload: ยังไม่ได้ยืนยัน | 503 `ServerOverloaded` บ่อย (50/192 ในการวัดนี้) |
| **NetEase** (ปัจจุบัน) | วัดได้ 22/26 | มี | ไม่เป็นทางการ: deployment ของ NeteaseCloudMusicApi (`neteasecloudmusic.api.soraharu.com`) ผ่าน proxy ของ upstream | ไม่ต้อง | repo ต้นทาง [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) ถูก archive และ README เขียนว่า "保护版权,此仓库不再维护" (หยุดดูแลเพื่อคุ้มครองลิขสิทธิ์) | ขึ้นกับ server และ proxy ของบุคคลที่สาม |
| **Spotify `color-lyrics/v2`** | Spotify โปรโมต Lyrics กับศิลปินไทย ([press release ผ่าน ThaiPR, 2022](https://www.thaipr.net/?p=3191526)) แต่ coverage รายเพลง: ยังไม่ได้ยืนยัน | มี (`LINE_SYNCED`, `startTimeMs`; บางเพลงเป็น `SYLLABLE_SYNCED`) ([beautiful-lyrics types](https://github.com/surfbryce/beautiful-lyrics/blob/main/Universal/Types/Spotify.ts)) | internal ไม่มีเอกสาร และ [Web API](https://developer.spotify.com/documentation/web-api) ไม่มี endpoint เนื้อเพลง | Bearer token ของ web player ผู้ใช้ (extension ใช้ header ของหน้าเว็บเอง) | [User Guidelines](https://www.spotify.com/us/legal/user-guidelines/) ห้าม scraping, automated means และ circumventing ส่วน [Developer Terms](https://developer.spotify.com/terms) นับ "song lyrics" เป็น Spotify Content ไม่พบ DMCA ที่ตั้งเป้าไปที่ตัวดึงเนื้อเพลง (รายงานของ agent) | เคยเปลี่ยนจาก `lyrics/v1` เป็น `color-lyrics/v2` ในปี 2024 ([spicetify PR #3064](https://github.com/spicetify/cli/pull/3064)) ซึ่งเป็นเหตุให้ upstream ใน repo นี้ปรับโค้ด |
| **Musixmatch API (ทางการ)** | `languages.get` มี `thai` และ `thai-romaji` ([docs](https://docs.musixmatch.com/api-reference/lyrics-catalog/languages-get.md)) และเป็นผู้ให้เนื้อ synced แก่ Spotify ([Spotify for Artists](https://support.spotify.com/us/artists/article/lyrics/)) ส่วนหน้าเพลงไทยบน musixmatch.com: ยังไม่ได้ยืนยัน | มี: `track.subtitle.get` (รายบรรทัด) และ `track.richsync.get` (รายคำ) ([docs](https://docs.musixmatch.com/api-reference/lyrics-catalog/track-subtitle-get.md)) | API ทางการแบบเสียเงิน | `apikey` ที่ต้องเก็บเป็นความลับ ([getting started](https://docs.musixmatch.com/getting-started.md)) จึงต้องมี backend | [API Terms](https://about.musixmatch.com/apiterms) (24 มิ.ย. 2025): 1.1 ใช้แบบ non-commercial เว้นแต่ตกลงเป็นหนังสือ, 2.2.13 ห้ามใช้ "in connection with any marketing, karaoke…", ต้องโหลด tracking pixel/script ([docs](https://docs.musixmatch.com/lyrics-views-tracking.md)) | เสถียร (เป็น API เชิงพาณิชย์) |
| **Musixmatch แบบไม่เป็นทางการ** (`apic-*.musixmatch.com` + `usertoken`) | เท่ากับ catalog ของ Musixmatch | มี | ไม่เป็นทางการ ([spicetify ProviderMusixmatch.js](https://github.com/spicetify/cli/blob/main/CustomApps/lyrics-plus/ProviderMusixmatch.js)) | token แบบไม่ระบุตัวตน ซึ่งโดน rate-limit หรือ captcha (401) | ขัดข้อ 2.2.4 ของ API Terms (ห้าม scrape หรือ reverse engineer) และ Musixmatch เคยส่ง [DMCA ปี 2017](https://github.com/github/dmca/blob/master/2017/2017-02-27-MusixMatch.md) ให้ถอดตัว scraper | ต่ำ: host และ app_id เปลี่ยนในปี 2026 ([PR #3790](https://github.com/spicetify/cli/pull/3790)) |
| **Apple Music** (TTML) | หน้า music.apple.com/th ของเพลงไทย 5 เพลงมีส่วน Lyrics (รายงานของ agent) ส่วนจะ synced หรือไม่: ยังไม่ได้ยืนยัน | มี (TTML `p@begin/end`, [spec](https://www.w3.org/TR/ttml1/#timing-attribute-begin)) | internal (`amp-api…/lyrics`) เพราะ API ทางการมีแค่ `hasLyrics` และ relationships ไม่มี lyrics ([attributes](https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary), [relationships](https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary)) | developer token + `media-user-token` ของสมาชิก | [ADPLA](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) §3.3.6(D): ห้าม sync MusicKit Content กับ content อื่น และ [Media Services Terms](https://www.apple.com/legal/internet-services/itunes/us/terms.html) กำหนดให้ใช้ผ่านซอฟต์แวร์ Apple เท่านั้น | Apple แจ้งว่าวิธีที่ไม่รองรับ "may be blocked at any time" ([forum](https://developer.apple.com/forums/thread/702228)) |
| **JOOX** (Tencent) | ยังให้บริการที่ [joox.com/th](https://www.joox.com/th) ตรวจหน้า single สาธารณะ 1 หน้า (label GMM) พบ `"lrc_exist":1`, `"language":"th"` และ LRC ไทยมีเวลา 49 บรรทัด ส่วน agent ตรวจ 5 หน้า มี timed LRC ไทย 4 หน้า | มี (LRC base64 ใน `lrc_content`) | ไม่เป็นทางการ: JSON ในหน้าเว็บ หรือ `web-fcgi-bin/web_lyric` ([musicdl](https://github.com/CharlesPikachu/musicdl/blob/master/musicdl/modules/sources/joox.py)) | หน้า single ไม่ต้องใช้ auth แต่ search API อาจต้องใช้ cookie (ยังไม่ได้ยืนยัน) | [User Terms](https://www.joox.com/en_my/app/user_terms.html) (8 มี.ค. 2021) ห้าม copy/store content, ห้าม circumvent, และ content "playable only within JOOX" | ปานกลาง (endpoint เก่าแต่ยังอยู่ใน config เว็บของ JOOX เอง) แต่ ISRC ถูก obfuscate จึงต้อง match ด้วยชื่อ |
| **YouTube Music / LyricFind** | LyricFind ประกาศดีลกับ MCT เพื่อ license เนื้อเพลงศิลปินไทย ([2019-02-18](https://lyricfind.rockpaperscissors.biz/dispatch/pu/25607)) แต่ coverage บน YT Music: ยังไม่ได้ยืนยัน | มี ([YouTube blog 2023](https://blog.youtube/news-and-events/youtube-music-app-2023-guide/)) | ไม่เป็นทางการ (InnerTube ผ่าน [ytmusicapi](https://github.com/sigma67/ytmusicapi/blob/main/ytmusicapi/mixins/browsing.py)) ส่วน LyricFind เป็น B2B เท่านั้น ([lyric display](https://www.lyricfind.com/products/lyric-display)) | ytmusicapi ระบุว่าไม่ต้อง auth | [YouTube ToS](https://www.youtube.com/t/terms) ห้ามเข้าถึงด้วย automated means | ปานกลาง (ต้องเลียนแบบ client) |
| **Deezer** | มีเพลงไทยใน catalog แต่ coverage เนื้อเพลง: ยังไม่ได้ยืนยัน | มี และเป็น Premium เท่านั้น โดยมี LyricFind เป็นผู้ให้ ([help, 11 เม.ย. 2026](https://support.deezer.com/hc/en-gb/articles/115004271149-Playing-and-sharing-lyrics-on-Deezer)) | public API ไม่มีเนื้อเพลง ต้องใช้ internal (`gw-light`/`pipe`) | ARL cookie หรือ JWT ของ session ที่ login | [Deezer terms](https://www.deezer.com/legal/cgu) ห้ามดึง content ด้วย script และให้ใช้ส่วนตัวเท่านั้น | ปานกลาง |
| **QQ Music / Kugou / Kuwo** | ยังไม่ได้ยืนยัน (TME–GMM มีความร่วมมือ [2020](https://www.prnewswire.com/news-releases/tencent-music-entertainment-group-enters-strategic-partnership-with-gmm-grammy-301112941.html) แต่ไม่ได้ระบุว่ามีเพลง GMM ในแอปเหล่านี้) | มี (QRC/KRC รายคำ, Kuwo รายบรรทัด) ([LDDC](https://github.com/chenmozhijin/LDDC/blob/main/LDDC/core/api/lyrics/qm.py)) | ไม่เป็นทางการ (ต้อง sign request หรือถอดรหัส) | anonymous แต่ต้องเลียนแบบแอป | สูง (ต้องเลี่ยงการป้องกันทางเทคนิค และ license จำกัดเฉพาะจีน) | ต่ำถึงปานกลาง |
| **Megalobiz** | sitemap มี LRC ที่ slug เป็นอักษรไทยประมาณ 2,495 จาก ~321k URL (รายงานของ agent, [sitemap](https://megalobiz.com/sitemap.xml)) แต่ไม่เจอศิลปินไทยหลักในการค้น | มี | scrape หน้าเว็บเท่านั้น | ไม่ต้อง | [terms](https://megalobiz.com/about/terms-and-conditions) ห้าม "Reproduce, duplicate or copy material" | ต่ำ (เว็บเพิ่งถูกสร้างใหม่ และ search เก่าตอบ 404) |
| **Lyricsify** | มี LRC เพลงไทย เช่น [หน้าศิลปิน Tilly Birds](https://www.lyricsify.com/artists/tilly-birds) | มี | scrape หน้าเว็บ (robots ห้าม `/search*`) | ไม่ต้อง | ไม่มีหน้า terms มีแต่ [disclaimer](https://www.lyricsify.com/disclaimer) "personal use only" และเนื้อน่าจะไม่มี license | ต่ำ (เคยติด Cloudflare) |
| **เว็บเนื้อเพลงไทย** (Siamzone ฯลฯ) | มีเนื้อไทยมาก แต่**เป็น plain text ไม่มี timestamp** ([ตัวอย่าง Siamzone](https://www.siamzone.com/music/thailyric/13667)) ส่วน Sanook ลิงก์เนื้อเพลงตอบ 404 | ไม่มี | ไม่มี API | – | [Siamzone terms](https://www.siamzone.com/info/term.php) ให้ใช้ผ่าน interface ของเว็บเท่านั้น | – |

ทำไมเนื้อเพลงบน Spotify ถึงมาจาก Musixmatch:
- [Spotify for Artists](https://support.spotify.com/us/artists/article/lyrics/) เขียนว่า "Musixmatch provides licensed and synced lyrics for Spotify" ยกเว้นญี่ปุ่นที่ใช้ PetitLyrics และ [newsroom ปี 2021](https://newsroom.spotify.com/2021-11-18/you-can-now-find-the-lyrics-to-your-favorite-songs-in-spotify-heres-how/) ก็ระบุว่าร่วมมือกับ Musixmatch
- ตัวอย่าง response ใน repo นี้เองมี `provider: 'MusixMatch'` และ `isSnippet: true` ([`src/page/types.ts#L458-L468`](../../src/page/types.ts#L458-L468))
- สำหรับ Apple มีแค่ [หน้า press ของ Musixmatch](https://about.musixmatch.com/press) ที่บอกว่า Apple Music เป็นลูกค้า Apple เองไม่ได้ระบุผู้ให้ (ยังไม่ได้ยืนยันจากฝั่ง Apple)

ราคา Musixmatch: [หน้า pricing](https://www.musixmatch.com/pro/api/pricing) มี Basic $49, Grow $199, Scale $499 และ Enterprise เริ่มที่ $2k ต่อเดือน โดย time-synced lyrics เริ่มที่ Grow และการ cache เนื้อเพลงมีเฉพาะ Enterprise ตัวเลขเหล่านี้ agent อ่านจาก JS ของหน้า pricing ครั้งเดียว และ www.musixmatch.com ปิด crawler ใน robots.txt จึงตรวจซ้ำไม่ได้ ราคาอาจเปลี่ยนได้ ส่วนที่ยืนยันซ้ำได้คือหน้า docs ระบุ plan "Grow" ให้ทั้ง `track.subtitle.get` และ `track.richsync.get`

---

## 4. ทางเลือกและ trade-offs (ยังไม่ตัดสิน)

| ทางเลือก | สิ่งที่ได้ (จากข้อมูลข้างบน) | ต้นทุน / ความเสี่ยง |
|---|---|---|
| **A. คงแหล่งเดิมแต่ปรับ matching** เช่น ใช้ alias ชื่อศิลปินไทย ↔ ละติน, ถือว่า lyric ที่มีแต่ credit คือ "ไม่มีเนื้อ" แล้วลอง candidate ถัดไปหรือแหล่งถัดไป, เพิ่มคำ credit ภาษาไทยและ 人声 ในตัวกรอง | ใน sample นี้จะได้กลับมา 2 เพลง (#16 จาก entry "ขอ" ของ NetEase และ #22 จาก LRCLIB "ต่าย อรทัย") ทำให้ได้ 24/26 ซึ่งเท่ากับเพดาน "มีในแหล่งใดแหล่งหนึ่ง" | งานโค้ดฝั่งเดียว ไม่เพิ่มความเสี่ยงทางกฎหมาย แต่ต้องมีแหล่ง alias (เช่น ใช้ชื่อศิลปินจาก metadata ของ Spotify, ตารางในตัว หรือ artist search) และ alias ที่หลวมเกินจะทำให้ match ผิด |
| **B. ใช้ Spotify `color-lyrics` เร็วขึ้น** (ตอนนี้อยู่ลำดับสุดท้าย) | ได้เนื้อ licensed จาก Musixmatch และไม่ต้อง match เพราะใช้ track id ตรง | ขัด User Guidelines (automated means / circumvent), ต้องใช้ token ของผู้ใช้, endpoint เคยเปลี่ยน (ข้อมูลเพิ่ม 2026-10-07: เปิด web player จริงแล้วดู `performance.getEntriesByType('resource')` เห็นว่ายังมี request ไปที่ `/metadata/4/track/` ซึ่ง `observer.ts` ดักอยู่ และมีการเรียก `color-lyrics/v2/track/...` ด้วย) |
| **C. Musixmatch API ทางการผ่าน backend** | ได้เนื้อ licensed แบบรายบรรทัด/รายคำ และ query ด้วย `track_spotify_id`/ISRC ได้ | อย่างน้อย $199/เดือน, ต้องได้รับอนุมัติก่อนเปิดสาธารณะ, ต้องมี tracking pixel และ attribution, ห้าม "karaoke" (2.2.13) ซึ่งการแสดงเนื้อแบบเลื่อนตามเพลงอาจเข้าข่าย (ต้องตีความ), ต้องดูแล server และเก็บ key เป็นความลับ |
| **D. เพิ่มโหมดแสดงเนื้อแบบ unsynced** (ใช้ `plainLyrics` ของ LRCLIB หรือ NetEase ที่ไม่มีเวลา) | ใน sample นี้เพิ่มได้ 2 เพลง (#19, #21) และเป็น fallback ให้เพลงเก่าหรือลูกทุ่งที่มีแต่ plain | ต้องทำ UI/renderer ใหม่ (ตอนนี้ทิ้งบรรทัดไม่มีเวลา) แต่ไม่เพิ่มแหล่งใหม่และไม่เพิ่มความเสี่ยงทางกฎหมายจากเดิม |
| **E. ให้ผู้ใช้ช่วยเติม** | LRCLIB มี `POST /api/publish` แบบ anonymous ที่ใช้ proof-of-work ([docs](https://lrclib.net/docs)) และ extension มี store สำหรับ upload ของตัวเองอยู่แล้ว ([`src/page/store.ts`](../../src/page/store.ts)) | เพิ่มเพลงทีละเพลง คุณภาพขึ้นกับผู้ใช้ และสิทธิ์ของเนื้อเพลงที่ผู้ใช้ส่งยังไม่ชัด |
| **F. JOOX** | มี timed LRC ภาษาไทยจริง และน่าจะครอบคลุม catalog GMM | ขัด User Terms (copy/store, ใช้นอก JOOX), ไม่มี API ทางการ และต้อง match ด้วยชื่อเพราะ ISRC ถูก obfuscate |
| **G. Apple Music, YouTube Music, Deezer, QQ/Kugou/Kuwo, Megalobiz/Lyricsify** | บางแหล่งอาจมีเพลงไทย (ยังไม่ได้ยืนยัน) | ToS ห้ามชัดเจน, ต้องใช้ subscription/login ของผู้ใช้ หรือเนื้อไม่มี license ถ้าดูจากหัวข้อ 3 จึงไม่เหมาะกับการใช้งานจริง |

ข้อสังเกตเพิ่มเติม (นอกขอบเขต): [LRCLIB docs](https://lrclib.net/docs) กำหนดให้ client ระบุตัวผ่าน `User-Agent` หรือใช้ `X-User-Agent`/`Lrclib-Client` ใน browser แต่ `request()` ของ extension ไม่ได้ส่ง header เหล่านี้ ([`src/page/request.ts`](../../src/page/request.ts))

---

## 5. ข้อจำกัดของการวัด

- sample มีแค่ 26 เพลง และเพลงในชาร์ตส่วนใหญ่เป็น pop/indie ช่วงปี 2024–2026 ลูกทุ่งมีเพียง 3 เพลง เปอร์เซ็นต์ของกลุ่มเพลงเก่าจึงไม่เสถียร
- ใช้ความยาวจาก Apple แทนความยาวบน Spotify และ 2 เพลงไม่รู้ความยาว (แต่ replay ทั้งสองแบบได้ผลเหมือนกัน)
- ชื่อศิลปินบน Spotify ของ #21 และ #22 ยังไม่ได้ยืนยัน ถ้า Spotify แสดงเป็นอักษรไทย ("ต่าย อรทัย") ผล replay ของ #22 อาจเปลี่ยน
- replay ไม่ได้รวม community store ของ extension และ Spotify built-in จึงเป็นค่าต่ำสุดของสิ่งที่ผู้ใช้จะเห็นจริง
- "synced" นับจาก timestamp และสคริปต์ของตัวอักษรเท่านั้น ไม่ได้ฟังเพลงเพื่อตรวจว่าเวลาตรงจริง (เพื่อเลี่ยงการทำงานกับเนื้อเพลงโดยตรง)
- เนื้อหาบางส่วนของหัวข้อ 3 มาจาก desk research ของ sub-agent ที่ระบุ URL ต้นทางไว้ ส่วนที่ผู้เขียนตรวจซ้ำเองแล้ว ได้แก่ Spotify for Artists, Spotify User Guidelines, Musixmatch API Terms (1.1, 2.2.4, 2.2.13, วันที่), plan ใน docs ของ Musixmatch, `languages.get`, Apple `hasLyrics`/relationships, Apple support เรื่อง lyrics, JOOX User Terms, หน้า single ของ JOOX, ประกาศ LyricFind–MCT, Deezer help, spicetify source และ PR, DMCA ปี 2017 ของ Musixmatch และ README ของ NeteaseCloudMusicApi

---

## 6. แหล่งอ้างอิง

**ข้อมูล sample**
- kworb, Spotify Weekly Chart Thailand (2026/10/01): https://kworb.net/spotify/country/th_weekly.html
- kworb, Thailand weekly totals: https://kworb.net/spotify/country/th_weekly_totals.html
- iTunes Search API documentation: https://performance-partners.apple.com/search-api

**แหล่งปัจจุบัน**
- LRCLIB API documentation (search สูงสุด 20 ผล, `/api/get`, rate limiting, `User-Agent`, `/api/publish`): https://lrclib.net/docs
- Binaryify/NeteaseCloudMusicApi (archived): https://github.com/Binaryify/NeteaseCloudMusicApi
- โค้ดใน repo นี้: `src/page/lrclib.ts`, `src/page/netease.ts`, `src/page/lyrics.ts`, `src/page/share-data.ts`, `src/page/observer.ts`, `src/page/types.ts`, `src/options/store.ts`, `src/page/config.json` และ upstream commit `f342697` ("feat: remove spotify built in lyrics", 2024-06-02)

**Spotify**
- Spotify for Artists, Lyrics: https://support.spotify.com/us/artists/article/lyrics/
- Spotify newsroom, 2021-11-18: https://newsroom.spotify.com/2021-11-18/you-can-now-find-the-lyrics-to-your-favorite-songs-in-spotify-heres-how/
- Spotify User Guidelines: https://www.spotify.com/us/legal/user-guidelines/
- Spotify Developer Terms: https://developer.spotify.com/terms
- Spotify Web API reference: https://developer.spotify.com/documentation/web-api
- spicetify lyrics-plus `Providers.js` (color-lyrics): https://github.com/spicetify/cli/blob/main/CustomApps/lyrics-plus/Providers.js
- spicetify PR #3064 (2024-06-07): https://github.com/spicetify/cli/pull/3064
- beautiful-lyrics Spotify types: https://github.com/surfbryce/beautiful-lyrics/blob/main/Universal/Types/Spotify.ts
- Spotify Thailand press release (ThaiPR wire, 2022-05-19): https://www.thaipr.net/?p=3191526

**Musixmatch**
- API pricing: https://www.musixmatch.com/pro/api/pricing
- `track.subtitle.get`: https://docs.musixmatch.com/api-reference/lyrics-catalog/track-subtitle-get.md
- `track.richsync.get`: https://docs.musixmatch.com/api-reference/lyrics-catalog/track-richsync-get.md
- `languages.get`: https://docs.musixmatch.com/api-reference/lyrics-catalog/languages-get.md
- Getting started (apikey): https://docs.musixmatch.com/getting-started.md
- Lyrics views tracking: https://docs.musixmatch.com/lyrics-views-tracking.md
- API Terms of Service (24 June 2025): https://about.musixmatch.com/apiterms
- Press: https://about.musixmatch.com/press
- spicetify `ProviderMusixmatch.js`: https://github.com/spicetify/cli/blob/main/CustomApps/lyrics-plus/ProviderMusixmatch.js และ PR #3790: https://github.com/spicetify/cli/pull/3790
- GitHub DMCA, Musixmatch 2017-02-27: https://github.com/github/dmca/blob/master/2017/2017-02-27-MusixMatch.md

**Apple Music**
- Songs attributes: https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary
- Songs relationships: https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary
- Apple Developer Program License Agreement: https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
- Apple Media Services Terms: https://www.apple.com/legal/internet-services/itunes/us/terms.html
- See lyrics in Apple Music: https://support.apple.com/en-us/105076
- Apple Developer Forums thread 702228: https://developer.apple.com/forums/thread/702228
- TTML timing attributes: https://www.w3.org/TR/ttml1/#timing-attribute-begin
- gamdl (ตัวอย่างการใช้ internal lyrics): https://github.com/glomatico/gamdl/blob/main/gamdl/api/apple_music.py

**JOOX**
- https://www.joox.com/th
- JOOX User Terms (8 Mar 2021): https://www.joox.com/en_my/app/user_terms.html
- JOOX Terms of Service: https://static.joox.com/platform/web_announcement/terms_service.html
- musicdl JOOX module: https://github.com/CharlesPikachu/musicdl/blob/master/musicdl/modules/sources/joox.py
- JOOX robots.txt: https://www.joox.com/robots.txt

**YouTube Music / LyricFind / Deezer / อื่น ๆ**
- YouTube blog (timed lyrics, 2023): https://blog.youtube/news-and-events/youtube-music-app-2023-guide/
- YouTube Terms of Service: https://www.youtube.com/t/terms
- ytmusicapi `browsing.py`: https://github.com/sigma67/ytmusicapi/blob/main/ytmusicapi/mixins/browsing.py
- LyricFind lyric display: https://www.lyricfind.com/products/lyric-display
- LyricFind–MCT (2019-02-18): https://lyricfind.rockpaperscissors.biz/dispatch/pu/25607
- Deezer lyrics help: https://support.deezer.com/hc/en-gb/articles/115004271149-Playing-and-sharing-lyrics-on-Deezer
- Deezer terms: https://www.deezer.com/legal/cgu
- TME–GMM Grammy (2020): https://www.prnewswire.com/news-releases/tencent-music-entertainment-group-enters-strategic-partnership-with-gmm-grammy-301112941.html
- LDDC (QQ/Kugou lyrics): https://github.com/chenmozhijin/LDDC/blob/main/LDDC/core/api/lyrics/qm.py
- Megalobiz terms: https://megalobiz.com/about/terms-and-conditions · sitemap: https://megalobiz.com/sitemap.xml
- Lyricsify: https://www.lyricsify.com/artists/tilly-birds · disclaimer: https://www.lyricsify.com/disclaimer
- Siamzone terms: https://www.siamzone.com/info/term.php · ตัวอย่างหน้าเนื้อเพลง: https://www.siamzone.com/music/thailyric/13667
