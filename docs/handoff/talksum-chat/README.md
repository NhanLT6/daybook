# Khung chat kính: gói bàn giao cho Daybook

Lấy từ mock và code của monetai_flutter (đọc ngày 2026-10-10). Mọi con số có nguồn `file:dòng`. Đường dẫn ngắn:

| Viết tắt | File |
|---|---|
| `CB` | `docs/superpowers/mockups/2026-10-05-capture-bar-split.html` (bản gốc: `original-capture-bar-split.html`) |
| `VF` | `docs/superpowers/mockups/2026-10-06-voice-in-features.html` (bản gốc: `original-voice-in-features.html`, cần thư mục `voice/` bên cạnh, đã copy) |
| `SPEC` | `docs/superpowers/specs/2026-10-05-capture-bar-split.md` |
| `GLASS` | `docs/design/glass-light-and-dye.md` |
| `bar` | `lib/shared/widgets/capture_bar.dart` |
| `card` | `lib/shared/widgets/form_chat_card.dart` |
| `drop` | `lib/shared/widgets/droplet_glass.dart` |
| `frag` | `shaders/droplet_glass.frag` |
| `surf` | `lib/features/agent/widgets/agent_surface.dart` |
| `tok` | `lib/design/spacing.dart` (AppRadius, AppShadows, AppMotion) |
| `pal` | `lib/design/palette.dart` |

Nhãn: **Có trong mock**, **Chỉ có trong Flutter**, **Không có (đề xuất)**. Khi mock và Flutter khác nhau, Flutter là bản đang chạy (đã ship), mock là bản đã duyệt trước đó.

Một điều quan trọng trước hết: **kính trong cả hai mock không phải CSS**. Cả hai vẽ bằng shader WebGL2 (`CB:450-632`, `VF:690-776`), không có `backdrop-filter` nào. Flutter port shader đó gần như nguyên dòng (`frag`), chỉ phần làm mờ nền là `BackdropFilter` (`drop:184`). Các giá trị CSS bên dưới là bản dịch từ số của shader, có ghi rõ chỗ nào là quy đổi.

---

## 1. Mock HTML của khung chat ở 4 trạng thái

**Trả lời:** `chat-frame-mock.html` (31 KB, một file, CSS/JS inline, chỉ link Google Fonts). Có nút chọn trạng thái, nút Sáng/Tối, và tham số URL `?state=rest|typing|expanded|waiting|collapsed|waitingBar&theme=light|dark`. Ảnh chụp: `screenshots/<state>-<theme>.png`.

CSS và JS lấy từ mock: lớp hàng (`.layer`/`.layer.off`, `CB:39-41`), nút 48px (`CB:42-45`), bản nháp (`CB:49`, `VF:46`), spinner và pop (`CB:52-55`), dòng chat, ba chấm (`VF:59-69`), pill lượt (`VF:53-54`, `VF:403-424`), lò xo (`VF:303-316`), cách đặt lớp (`VF:442-462`), gửi rồi trả lời sau 1,3 giây (`VF:481`, `VF:524-550`), cuộn để thu thẻ (`VF:593-623`), Enter để gửi (`VF:591`). Mọi class có tiền tố `tsc-` và mọi rule nằm dưới `.tsc-root`, nên đặt vào app Vuetify không đụng CSS toàn cục.

| Trạng thái Nhan hỏi | Trong file | Nhãn |
|---|---|---|
| Ẩn, chỉ lộ một cạnh | Không có trạng thái này trong mock lẫn Flutter. Gần nhất: `rest` (thanh nghỉ: pill 60px + vòng mic 60px, cách đáy 20px, `CB:170-171`, `CB:215`) và `collapsed` (thẻ thu chỉ còn dòng AI mới nhất, `VF:266-275`) | Không có (đề xuất: dùng `rest` hoặc `collapsed`) |
| Hover / đang gõ | `typing`: ✕, bản nháp, Gửi trong pill, vòng nhỏ là mic (`CB:218`, `SPEC:24-31`). Mock không có `:hover` nào (đếm `:hover` trong cả hai file: 0) | Có trong mock (typing). Hover: Không có |
| Mở rộng, có tin nhắn | `expanded`: thẻ trò chuyện trên form (`VF:276-282`, `VF:336-345`) | Có trong mock |
| Chờ AI trả lời | `waiting`: dòng AI là ba chấm, hàng soạn trống, mic mờ (`VF:341`, `VF:353-355`, `VF:369-370`). Thêm `waitingBar`: lần gửi đầu khi chưa có thẻ, vòng quay + "Đang điền form…" (`VF:355`) | Có trong mock |

Những gì file này **không** làm lại được, ghi thật:
- Cổ nối dính giữa pill và vòng tròn (Giọt, `frag` smooth-min, `drop:100-122`): CSS không gộp hai hình dưới một `backdrop-filter`. Hai hình chỉ co giãn bằng lò xo.
- Viền kính theo ánh sáng (Fresnel, specular) chỉ là xấp xỉ bằng `inset box-shadow`, xem mục 2.
- Mép trên gợn theo giọng (`CB:474-479`) và quả cầu mực khi để yên (`GLASS:41-57`): không có, cần WebGL.
- Nền phía sau là danh sách vẽ bằng HTML để minh hoạ; mock gốc dùng ảnh chụp app (`CB:169` base64, `VF:239` ảnh `voice/*.jpg`).
- Trong sandbox, Google Fonts bị chặn chứng chỉ, nên ảnh chụp hiện font dự phòng. Mở trên máy thật sẽ có Be Vietnam Pro.

---

## 2. Thông số kính sáng và tối

**Trả lời:** kính của ta là kính **trong và mỏng**: mờ nhẹ (tương đương `blur(3.5px)`), lớp phủ mỏng (trắng 24% ở chế độ sáng, màu surface 42% ở chế độ tối), **không có viền vẽ**, mép sáng ở một phía theo hướng đèn khác nhau từng chế độ, bóng đổ, bo 30px. `glass-acrylic` của Daybook là kính **mờ đục** (mờ 25.6px, phủ 83%/77%, viền đều 1px). Hai thứ khác nhau gần như ở mọi thuộc tính, nên **giữ một class riêng**, không dùng lại, không làm modifier (lý do và diff ở cuối mục).

### 2.1 Giá trị của ta (Flutter đang chạy = mock, trừ khi ghi khác)

| Thuộc tính | Sáng | Tối | Nguồn | Nhãn |
|---|---|---|---|---|
| Làm mờ nền | Mock: trung bình 32 điểm trong đĩa bán kính 7px. Flutter: Gaussian sigma 3.5. CSS: `blur(3.5px)` | giống | `CB:501-509` + `CB:544` (`7.`), `VF:738-746` + `VF:759`, `drop:184` | Có trong mock |
| Quy đổi blur | Đĩa đều bán kính R có độ lệch chuẩn mỗi trục R/2, nên 7px ra 3.5, khớp sigma Flutter. CSS `blur(N)` là độ lệch chuẩn N (`bar:465`) | | tự tính | |
| `saturate` | Không có | Không có | không có trong `frag`, `CB`, `VF`. Phương án "Mờ dần và kính dày" (đĩa 16px, giảm bão hoà còn 55%) bị loại, mặc định là `fade`: `CB:544-546`, `CB:193`, `GLASS:37-39` | Có trong mock |
| Màu phủ (veil) | surface `#FFFFFF` ở 0.24, tức `rgba(255,255,255,.24)` | surface `#262A31` ở 0.42, tức `rgba(38,42,49,.42)` | `frag:156`, `CB:456` (`VEIL_LIGHT .24`, `VEIL_DARK .42`), `CB:532`, `VF:758-759`, `pal:20`, `pal:36` | Có trong mock |
| Viền vẽ (border) | Không có. Viền đều mọi phía từng bị bỏ vì đọc như khung | Không có | `GLASS:12`, `GLASS:30-31` | |
| Hướng đèn | Từ dưới phải, vector `(.62, .78)` | Từ trên trái, `(-.62, -.78)` | `frag:186`, `CB:556`, `SPEC:63-68` | Có trong mock |
| Gờ mép (bevel) | 3.5px cuối cong xuống | giống | `frag:190`, `GLASS:21-23` | |
| Fresnel (vệt sáng quanh mép) | trắng, cường độ 1, phía khuất đèn còn 0.22 | cường độ 0.6 | `frag:194`, `GLASS:16` | |
| Specular (vệt trắng mảnh) | Blinn-Phong mũ 60, 0.7 | 0.45 | `frag:199`, `GLASS:17` | |
| Ánh sáng ló ra mép xa | dải 3 đến 9px bên trong, 0.06 | 0.02 | `frag:204`, `GLASS:18` | |
| Mép tối phía xa đèn | 1px `rgb(20,28,38)` ở 0.12 | 1px đen ở 0.08 | `frag:207-210`, `GLASS:19` | |
| Bóng đổ | Hai lớp: sát 6% (lệch 1px), nâng 5% (lệch 10px, tán khoảng -12 đến 24px) | Một lớp 8% (`.05*1.6`), lệch 6px | `frag:134-137`, `SPEC:58-60`, `CB:522-525` | Có trong mock |
| Bóng vươn xa | 40px quanh hình | 40px | `drop:140`, `surf:55` | |
| Bo góc | 30px (pill cao 60 nên tròn hẳn hai đầu; thẻ chat cũng 30) | 30px | `drop:68`, `CB:208`, `VF:59`, `VF:257` | Có trong mock |
| Chữ trên kính | không giãn chữ, halo `0 0 6px` + `0 0 2px` màu `rgba(255,255,255,.75)` | halo `rgba(20,22,26,.7)` (Flutter: `bg` 0.7) | `CB:189-190`, `CB:315`, `bar:130-137` | Có trong mock |
| Nền mờ dần phía trên thanh | trang mờ về màu nền 82% trong 60px trên thanh, đường smoothstep | giống | `surf:61-64`, `surf:372`, `CB:499`, `VF:736` | Có trong mock |
| Màu nền trang | `#F7F7F7` | `#1E2229` | `pal:35`, `pal:19`, `CB:767` | |

### 2.2 Bản dịch CSS dùng trong `chat-frame-mock.html` (xấp xỉ, không phải giá trị gốc)

```css
/* Sáng: đèn dưới phải, nên vệt sáng ở mép phải và dưới, mép mực ở trên trái */
backdrop-filter: blur(3.5px);
background: rgba(255,255,255,.24);
box-shadow:
  inset -1.5px -1.5px 1px -.5px rgba(255,255,255,.95), /* Fresnel + specular phía đèn */
  inset 1px 1px 0 0 rgba(20,28,38,.12),               /* mép tối phía xa đèn */
  inset 0 0 0 1px rgba(255,255,255,.22),               /* Fresnel phía khuất (0.22) */
  0 1px 2px rgba(0,0,0,.06), 0 10px 24px rgba(0,0,0,.05);
border-radius: 30px;

/* Tối: đèn trên trái */
background: rgba(38,42,49,.42);
box-shadow:
  inset 1.5px 1.5px 1px -.5px rgba(255,255,255,.45),
  inset -1px -1px 0 0 rgba(0,0,0,.08),
  inset 0 0 0 1px rgba(255,255,255,.06),
  0 6px 22px rgba(0,0,0,.08);
```

Ở chế độ tối, lần chụp đầu dùng vòng đều trắng 0.13 (0.22 x 0.6) và nó đọc thành viền quanh hình, đúng lỗi `GLASS:30-31` mô tả, nên hạ xuống 0.06 và vệt đèn xuống 0.45. Ánh sáng ló ra mép xa (0.06/0.02) bỏ qua vì quá nhỏ để thấy bằng box-shadow.

### 2.3 So với `glass-acrylic` của Daybook

Nguồn Daybook (chỉ đọc): `src/assets/main.css:102-113`, `src/App.vue:37-46` (slider), `src/App.vue:153` (`nav.app-dock glass-acrylic`), `src/App.vue:308-318` (`.app-dock`).

| Thuộc tính | `glass-acrylic` sáng | `glass-acrylic` tối | Kính chat của ta sáng | Kính chat của ta tối |
|---|---|---|---|---|
| blur | `var(--glass-blur, 25.6px)`, slider 0 đến 32px (`App.vue:43`) | giống | 3.5px, cố định | 3.5px |
| saturate | không | không | không | không |
| nền | `rgba(255,255,255, .83)`, slider .48 đến .92 | `rgba(28,28,28, .77)` `!important`, slider .42 đến .86 | `rgba(255,255,255,.24)` | surface ở .42 |
| viền | `1px solid rgba(255,255,255,.7) !important` | `1px rgba(255,255,255,.06) !important` | không viền; mép sáng một phía + mép mực phía kia | như vậy, đèn ngược hướng |
| hướng đèn | không có | không có | dưới phải | trên trái |
| bóng | không | không | 2 lớp | 1 lớp |
| bo góc | không có trong class (`.app-dock` tự đặt 8px) | | 30px | 30px |
| điều khiển | slider Settings | | cố định theo thiết kế | |

Những thứ kính chat cần mà `glass-acrylic` không có: hướng đèn riêng cho từng chế độ, mép sáng/mép mực thay cho viền đều, bóng đổ, bo 30px, halo chữ, và nền trang mờ dần phía trên thanh. Những thứ `glass-acrylic` có mà kính chat không muốn: phủ 77 đến 83% (nền gần như đục, mất cảm giác trong), blur 25.6px (gấp khoảng 7 lần), viền đều 1px (đúng thứ đã bị bỏ), và độ đậm chạy theo slider.

**Đề xuất: class riêng.** Không làm modifier vì modifier phải đè gần hết thuộc tính, và hai thuộc tính của bản tối dùng `!important` (`main.css:110`, `main.css:113`), nên modifier cũng phải `!important` theo, dễ vỡ. Dùng chung chỗ khai báo, cùng tiền tố `.v-theme--*` để theo theme của Vuetify. Đặt sau `main.css:121`:

```diff
--- a/src/assets/main.css
+++ b/src/assets/main.css
@@ -121,0 +122,30 @@
+/* Clear glass: the chat bar and card (from monetai DropletGlass). Thin on purpose,
+   so it does not follow the Glass Effect slider. Radius is set by the component. */
+.v-theme--light .glass-clear {
+  background: rgba(255, 255, 255, 0.24);
+  backdrop-filter: blur(3.5px);
+  -webkit-backdrop-filter: blur(3.5px);
+  box-shadow:
+    inset -1.5px -1.5px 1px -0.5px rgba(255, 255, 255, 0.95),
+    inset 1px 1px 0 0 rgba(20, 28, 38, 0.12),
+    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
+    0 1px 2px rgba(0, 0, 0, 0.06),
+    0 10px 24px rgba(0, 0, 0, 0.05);
+}
+
+.v-theme--dark .glass-clear {
+  /* .42 of the theme surface; monetai's is #262A31, Daybook's own may differ */
+  background: rgba(var(--v-theme-surface), 0.42);
+  backdrop-filter: blur(3.5px);
+  -webkit-backdrop-filter: blur(3.5px);
+  box-shadow:
+    inset 1.5px 1.5px 1px -0.5px rgba(255, 255, 255, 0.45),
+    inset -1px -1px 0 0 rgba(0, 0, 0, 0.08),
+    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
+    0 6px 22px rgba(0, 0, 0, 0.08);
+}
```

Cần so khi tích hợp: (1) đặt thanh chat cạnh `nav.app-dock` ở cả hai theme, xem hai loại kính có trông như hai họ khác nhau không; nếu Nhan muốn một họ, cân nhắc để thanh chat dùng chung `--glass-blur` nhưng chặn trên khoảng 4px; (2) `rgba(var(--v-theme-surface), .42)` cần Vuetify khai báo `--v-theme-surface` dạng `r,g,b` (Vuetify 3 làm vậy, nhưng nên kiểm); (3) xem kính trên nền nhiều chữ: ta giải quyết bằng nền trang mờ dần 82% trong 60px, không bằng blur dày (`GLASS:33-39`).

Trong `chat-frame-mock.html`, theme đi theo `data-theme` trên `.tsc-root`. Khi đưa vào Daybook, đổi selector `.tsc-root[data-theme="dark"]` thành `.v-theme--dark .tsc-root`.

---

## 3. Animation: thời lượng và easing

**Trả lời:** hình kính không chạy theo thời lượng cố định mà theo **lò xo**: độ cứng 195, giảm chấn 11.2 (khối lượng 1), nẩy rõ. Phần nở ra/thu lại của bề mặt pill thành sheet là **320ms** `cubic-bezier(0.3, 0.7, 0.4, 1)`, cùng một giá trị cho cả hai chiều. Thẻ chat trong Flutter đổi chiều cao bằng **260ms** cùng đường cong đó; trong mock là lò xo.

| Chuyển động | Giá trị | Nguồn | Nhãn |
|---|---|---|---|
| Lò xo của mọi hình (Giọt) | stiffness 195, damping 11.2, tỉ lệ khoảng 0.4 | `CB:246-259`, `VF:303-316`, `bar:813-814`, `SPEC:77` | Có trong mock |
| Đặc tính lò xo (tự tính từ 195/11.2) | zeta = 11.2 / (2 x sqrt 195) = 0.40; vượt đích khoảng 25%; vào trong 1% sau khoảng 0.81 giây | mô phỏng bằng node, cùng công thức | |
| Lò xo cho CSS (đề xuất, sinh từ mô phỏng, 1s) | `linear(0, 0.056, 0.198, 0.39, 0.599, 0.799, 0.972, 1.105, 1.194, 1.242, 1.252, 1.233, 1.194, 1.144, 1.091, 1.042, 1, 0.969, 0.948, 0.938, 0.937, 0.943, 0.953, 0.966, 0.979, 0.992, 1.002, 1.009, 1.014, 1.016, 1.016, 1.014, 1.011, 1.008, 1.005, 1.002, 0.999, 0.997, 0.996, 0.996, 1)` (điểm cuối đặt về 1) | tự tính | Không có (đề xuất) |
| Bước lò xo | thời gian thật, chặn 1/20 giây, 2 bước con (mock); chặn 0.1 giây, 240 bước/giây (Flutter) | `CB:717-720`, `bar:329-336` | |
| Nổi lên (rise-up) | Mock: pill mới mọc từ một chấm 6px ở `cx = 307` rồi lò xo ra kích thước (`VF:289`). Flutter: bề mặt nở từ pill thành sheet 320ms, bo góc 30 sang 28, bóng `AppShadows.overlay` nội suy theo | `VF:289`, `surf:85-88`, `surf:168`, `surf:185`, `surf:209`, `surf:285-287`, `tok:76` | Mock: chấm mọc. Flutter: 320ms |
| Nở cao (height expand), bản nháp | lò xo, mỗi dòng 21px, tối đa 3 dòng rồi cuộn | `CB:172`, `CB:345-351`, `bar:762-763`, `SPEC:36-37` | Có trong mock |
| Nở cao, thẻ chat | Mock: lò xo tới `composerHeight + chiều cao các dòng + 8` (`VF:266-275`). Flutter: `AnimatedSize` 260ms `AppMotion.standard`, neo đáy | `VF:266-282`, `card:222-227`, `tok:82` | Khác nhau, Flutter đang chạy |
| Thu lại (collapse) | Cùng giá trị như lúc nở (bề mặt: 320ms reverse; thẻ: lò xo / 260ms). Thẻ thu khi cuộn xuống quá 0.5px, mở lại khi cuộn lên hoặc về đầu (dưới 2px) | `surf:84-88`, `VF:598-605`, `savings_add_page.dart:100-113` | Có trong mock |
| Đổi hàng trong pill | 280ms `ease`: blur 7px, scale 0.92, mờ dần | `CB:39-40`, `bar:452-475` (`Curves.ease`), `tok:97` | Có trong mock |
| Đổi hàng trong thẻ chat (Flutter) | chỉ mờ dần 280ms, không blur, không scale | `card:327-333` | Chỉ có trong Flutter (khác mock) |
| Dòng chat hiện ra | 0.28s `cubic-bezier(.2,.8,.2,1)`, từ mờ và thấp 6px | `VF:61`, `VF:65` | Có trong mock; Flutter không có |
| Ba chấm chờ | mỗi chấm 1s lặp, trễ 0.15s và 0.3s, độ đục 0.35 lên 1 ở 30% | `VF:66-69` | Có trong mock; Flutter dùng chữ |
| Vòng quay | 0.8s `linear` | `CB:52-53` | Có trong mock |
| Icon nảy khi đổi giọng/gõ | 0.42s `cubic-bezier(.3,.7,.4,1)`, scale 0.55, 1.18, 0.94, 1 | `CB:54-55`; Flutter 420ms, trọng số 55/25/20 (`bar:880-886`) | Có trong mock |
| Nẩy khi đổi chế độ | Mock: vòng từ 72% với vận tốc 160, pill `hh` +70, `cy` -35. Flutter: `pop(0.72, 320)`, mép trên pill -100, mép dưới +30 | `CB:374-380`, `bar:307-316` | Khác nhau |
| Cổ nối Giọt | vươn `4 + 52 x goo` px, goo giảm 1.1/giây | `CB:748`, `CB:256`, `drop:42`, `bar:337` | Có trong mock |
| Tự gửi khi im | 1.6 giây sau từ cuối | `CB:395`, `SPEC:49` | Có trong mock |
| AI trả lời giả lập | 1.3 giây | `VF:481` | Chỉ trong mock |
| Toast, pill lượt | mờ dần 0.2s | `CB:56`, `VF:53` | Có trong mock |
| Giảm chuyển động | hình nhảy thẳng tới đích, tắt sóng, nảy, ba chấm, dòng hiện ra | `CB:77`, `CB:721`, `VF:98`, `card:222`, `SPEC:81` | Có trong mock |

---

## 4. Menu lệnh `/` và chip lệnh trong ô nhập

**Trả lời: Không có.** Không mock, spec hay file Dart nào có slash command hay chip lệnh. Đã tìm `slash`, `command menu`, `/` làm phím kích hoạt, `Shortcuts`, `SingleActivator`, `LogicalKeyboardKey` trong `lib/`, `docs/superpowers/specs/`, hai mock và `docs/wiki/features/capture.md`: không có kết quả nào liên quan.

Thứ gần nhất trong ô nhập: câu gợi ý theo tính năng ở trạng thái nghỉ ("Nhập hoặc nói: gửi 100tr VCB 6 tháng", `VF:224`, `VF:360`; Flutter `restHint`, `bar:45-46`) và gợi ý xoay vòng "Gõ hoặc nói" (`SPEC:26`, `SPEC:114`).

**Đề xuất (Không có trong mock):** nếu Daybook cần, làm menu như một tấm kính cùng họ mọc lên ngay trên pill bằng cùng lò xo (195/11.2), mục chọn là ink outline thay vì nền màu (quy tắc chọn của monetai, `docs/COMPONENTS.md`), chip lệnh dùng nền `quietFill` (`bar:127`: chữ ở 6%/8%) bo tròn, đặt trước bản nháp trong `textarea`. Cần mock riêng trước khi làm.

---

## 5. Pill timeline / lịch sử

**Trả lời: Không có pill lịch sử.** Có ba thứ gần:

| Thứ | Mô tả | Nguồn | Nhãn |
|---|---|---|---|
| Pill "Còn n lượt hôm nay" | Pill nhỏ ngay trên mép thẻ, cột mic, cách mép phải 4px, cao 28px tính cả khoảng cách. Đếm lượt AI, không phải lịch sử. Ẩn khi thẻ thu | `VF:53-54`, `VF:403-424`, `card:65`, `card:74`, `card:107-110`, `card:291-316` | Có trong mock |
| Thu thẻ còn dòng AI mới nhất | Cách "gấp lịch sử" duy nhất trong khung chat | `VF:266-275`, `card:220-221` | Có trong mock |
| Nhãn thời gian trong ledger | `TimeMarker`: chữ in hoa giữa, 12px, w600, giãn chữ 0.8, màu faint, đệm trên 12, dưới 8. Không phải pill | `lib/features/agent/widgets/time_marker.dart:56-66`, `lib/design/typography.dart:75-79`, `agent_timeline.dart:77-83` | Chỉ có trong Flutter |

Pill lượt, hai bản:

| | Mock | Flutter |
|---|---|---|
| Đệm | 3px 10px | 2px 12px (`AppSpacing.xxs`, `m`) |
| Chữ | 12px/16px, faint | `micro` 12px, faint |
| Nền | `card` (#FFFFFF / #262A31) | `mt.surface` |
| Bóng | `0 1px 2px rgba(0,0,0,.08), 0 4px 12px -4px rgba(0,0,0,.12)` | `AppShadows.raised`: `0 1px 2px` đen 3.5% + `0 2px 6px` đen 3% |
| Khi chờ AI | ẩn | vẫn hiện (chỉ ẩn khi hết lượt, mất mạng) |
| Nguồn | `VF:53-54`, `VF:409-410` | `card:303-307`, `card:67`, `card:74`, `tok:47-50` |

---

## 6. Mobile/touch và phím tắt

**Trả lời:** phím tắt duy nhất là **Enter để gửi, Shift+Enter xuống dòng** (mock). Không có Esc, không có tổ hợp phím nào khác, không có hover. Phần chạm: vùng chạm 48px cho icon 20px, chạm vào chữ khi đang nghe thì chuyển sang gõ, kéo để cuộn, cuộn để thu thẻ.

| Mục | Giá trị | Nguồn | Nhãn |
|---|---|---|---|
| Enter gửi, Shift+Enter xuống dòng | `keydown`, chỉ gửi khi có chữ | `CB:419`, `VF:591` | Có trong mock |
| Enter gửi (Flutter) | `textInputAction: send`, `onSubmitted`, 1 đến 3 dòng | `bar:762-765` | Chỉ có trong Flutter |
| Esc, Ctrl/Cmd tắt | Không có | tìm `Escape`, `keydown`, `Ctrl` trong `lib/features/agent`, `bar`: không có | Không có |
| Dán ảnh Ctrl+V, kéo thả ảnh (web) | có, vào bề mặt chat | `docs/superpowers/specs/2026-07-29-image-capture-design.md:150`, `surf:33-39` | Chỉ có trong Flutter |
| Vùng chạm | 48x48, icon 20px nét 1.75 | `CB:42-44`, `VF:37-39` | Có trong mock |
| Nút tròn nhỏ | mock 40px, Flutter 44px trong vùng 48 (quy tắc 12: 44 nhìn, 48 chạm) | `CB:45`, `SPEC:33-34`, `bar:109-110` | Khác nhau, Flutter đang chạy |
| Chạm vào chữ khi đang nghe | dừng nghe, giữ chữ, mở gõ | `CB:414`, `bar:759-761`, `SPEC:44-45` | Có trong mock |
| Focus khi mở gõ | sau 60ms, `preventScroll`, con trỏ cuối chữ | `CB:369`, `VF:488` | Có trong mock |
| Focus trên iOS Safari | phải gọi `focus()` ngay trong cú chạm, nếu không bàn phím không lên; lớp ẩn giữ nguyên, không gỡ | `bar:58-60`, `bar:449-451`, `docs/wiki/features/capture.md:61-63` | Chỉ có trong Flutter |
| Bàn phím đẩy | đang nghỉ: pill đi theo bàn phím; đang mở: sheet đứng yên, chỉ nội dung nâng lên | `surf:147-149`, `surf:205-207`, `capture.md:58-60` | Chỉ có trong Flutter |
| Kéo trang sau thanh | `pointerdown/move/up`, có quán tính | `CB:672-677`, `CB:722-724` | Có trong mock |
| Kéo/cuộn form để thu thẻ | lăn chuột hoặc kéo; kéo quá 4px thì không tính là chạm | `VF:606-623` | Có trong mock |
| Chạm vào ô của form | thẻ thu lại, rồi cuộn để ô không bị che | `savings_add_page.dart:117-123` | Chỉ có trong Flutter |
| Đóng sheet | chạm vùng mờ, nút back Android, vuốt back iPhone; có hỏi trước khi bỏ việc dở | `surf:132-134`, `surf:171-179`, `surf:228-251`, `capture.md:64-65` | Chỉ có trong Flutter |
| `touch-action` | `none` trên khung điện thoại để kéo được | `CB:37` | Có trong mock |
| Viền focus bàn phím | `outline: 2px solid brand; outline-offset: -4px` | `CB:43`, `VF:38` | Có trong mock |
| Giảm chuyển động | xem mục 3 | | |

---

## 7. Font, icon, asset

**Trả lời:** Be Vietnam Pro (400/500/600/700) cho chữ và Space Grotesk (500/600) cho số, cả hai lấy từ Google Fonts trong mock. Icon là SVG inline kiểu Tabler (viewBox 24, nét 1.75, đầu tròn); Flutter dùng gói `flutter_tabler_icons`. Asset đặc biệt duy nhất là ảnh nền chụp từ app và shader WebGL2.

| Thứ | Mock | Flutter | Nguồn |
|---|---|---|---|
| Font chữ | Be Vietnam Pro 400, 500, 600, 700 (Google Fonts) | `BeVietnamPro`, file ttf đóng gói, cùng 4 độ đậm | `CB:2-3`, `VF:4-5`, `pubspec.yaml:113-122` |
| Font số | Space Grotesk 500, 600 (Google Fonts) | `SpaceGrotesk[wght].ttf` (variable) | `CB:17`, `pubspec.yaml:123-125` |
| Font logo | không dùng | `Jost` 600, chỉ cho wordmark | `pubspec.yaml:126-131` |
| Cỡ chữ thanh | 15px/21px | 15px, giãn chữ 0 | `CB:47-49`, `bar:133-136` |
| Cỡ chữ dòng chat | 14px/20px | `txSubtitle` 14px, cao dòng 1.43 | `VF:61`, `card:262`, `typography.dart:94-98` |
| Icon | SVG inline: photo, form/plus, mic, micOff, x, keyboard, arrow up, play, wifiOff | `TablerIcons.*` | `CB:174-185`, `VF:204-214`, `pubspec.yaml:60`, `bar:564-571` |
| Icon nút form | mock thanh: hình form (`CB:176`); mock tính năng và Flutter: dấu + | | `VF:205`, `bar:506` |
| Ảnh nền | `CB`: PNG base64 sáng/tối 801 KB trong `CB:169` (không copy sang mock mới). `VF`: `voice/*.jpg` (đã copy vào `voice/`) | không có | `CB:169`, `VF:238-239` |
| Shader | WebGL2 fragment shader trong file | `shaders/droplet_glass.frag` (FragmentShader) | `CB:457-632`, `VF:695-776`, `drop:146-147` |
| Âm thanh, Lottie, ảnh khác | Không có | Không có | |

---

## Khác biệt mock và Flutter đáng chú ý

| Mục | Mock | Flutter (đang chạy) | Nguồn |
|---|---|---|---|
| Thứ tự trong pill nghỉ | ảnh, form, vạch, ô chữ | ô chữ, ảnh, + (không vạch), Nhan đổi 2026-10-09 | `CB:299`; `bar:482-512`, `docs/COMPONENTS.md:270-271` |
| Nút tròn nhỏ | 40px | 44px | `CB:45`; `bar:110` |
| Tím của AI (nền / chữ), sáng | `#F1EEFE` / `#4B3A9E` | `#EFEAFD` / `#4E3D8F` | `VF:218`; `pal:73-75` |
| Tím của AI, tối | `#2A2640` / `#C9BFFF` | `#282142` / `#B3A6F0` | `VF:219`; `pal:76-78` |
| Chữ faint | `#8E98A1` / `#78828C` | `#8A959F` / `rgba(226,230,238,.42)` (`0x6C`) | `VF:218-219`; `pal:29`, `pal:43` |
| Bo dòng chat | 18px | 20px (`AppRadius.lg`) | `VF:61`; `card:280`, `tok:23` |
| Khoảng cách dòng | 6px | 8px | `VF:60`; `card:241` |
| Rộng tối đa dòng | 86% | 80% | `VF:61`; `card:242` |
| Dòng gợi ý | 13px/18px, đệm 2px 12px | `micro` 12px, cao 1.4, đệm 2px 12px | `VF:64`; `card:276-283` |
| Chờ AI | ba chấm | dòng AI chữ "Đang điền biểu mẫu…" | `VF:341`; `card:218`, `app_vi.arb:2368` |
| Chiều cao thẻ | lò xo | 260ms, tối đa 40% màn hình rồi cuộn trong thẻ | `VF:468`; `card:222-233` |
| Đổi hàng trong thẻ | blur + scale + mờ | chỉ mờ | `VF:34-35`; `card:327-333` |
| Dòng hiện ra | 0.28s trượt lên 6px | không có | `VF:61-65`; `card:253-289` |

Kính (veil, viền theo ánh sáng, bóng, hướng đèn) và lò xo giống nhau giữa mock và Flutter, vì Flutter port nguyên shader (`SPEC:100`, `SPEC:108`).
