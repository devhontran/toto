# Thành phố zombie → sân bay — Design Spec

Ngày: 2026-09-27 · Thay thế bản đồ "một con đường" của spec gốc (§3 Nhịp một ván, §6 mốc 3–6 về bản đồ).

## Tổng quan
Người chơi (góc nhìn thứ nhất, Minecraft style) cùng 3 bot đi xuyên một thành phố Minecraft từ khu dân cư phía nam tới sân bay phía bắc, hạ boss zombie ở sân bay, lên máy bay và cất cánh thoát khỏi thành phố. Có bản đồ nhỏ (minimap) và bản đồ lớn để đi đúng hướng. Mọi thứ nhìn thấy đều là khối Minecraft.

## Bản đồ thành phố (dữ liệu, `src/level/city.ts`, không import three)
- Kích thước ~260 m (X) × ~420 m (Z). Lưới đường phố rộng 12 m, cách nhau ~44 m theo cả hai trục; ô phố (block) ~32×32 m.
- Mỗi ô phố: 1–4 công trình, sinh xác định theo seed: nhà 1 tầng (khu nam), cửa hàng 1–2 tầng (giữa), chung cư 3–5 tầng (khu trung tâm), công viên có cây (một vài ô).
- Mỗi công trình = `Building { box: Box; floors: number; style: 'house' | 'shop' | 'apartment'; door: 'N'|'S'|'E'|'W' }`. Va chạm = `box` đặc (chưa vào trong nhà ở mốc này).
- Tuyến đường (route): danh sách waypoint trên tim đường phố, từ điểm xuất phát (góc đông nam) tới cổng sân bay (phía bắc), có rẽ ít nhất 4 lần, dài ~550 m.
- Sân bay: vùng trống phía bắc ~120×80 m, hàng rào khối, cổng vào, đường băng bê tông (vạch trắng), tháp điều khiển, máy bay khối đậu ở đầu đường băng, cầu thang lên máy bay. Vùng lên máy bay `BOARD_ZONE` (tròn r 5 m cạnh cầu thang).
- Biên bản đồ: tường bao quanh (như hiện tại).

## Logic thay đổi
- **Tiến độ theo route**: hàm thuần `routeProgress(route, x, z) → { distance, segment, next: Vec2 }` (chiếu điểm lên polyline). Dùng cho spawner, bot, boss, HUD.
- **Spawner**: sinh zombie ở điểm trên route cách tiến độ người chơi 45–70 m về phía trước, lệch ngang ngẫu nhiên trong bề rộng đường, cộng thêm ~30% sinh ở đường nhánh gần đó; không sinh trong công trình. Giới hạn số lượng theo tiến độ (như cũ). Không sinh trong sân bay sau khi boss xuất hiện.
- **Bot**: đi theo route (waypoint kế tiếp), mỗi bot lệch ngang −3/0/+3 m so với tim đường; vẫn độc lập (không chờ người chơi), vẫn dừng bắn khi zombie trong 10 m, vẫn ưu tiên đỡ đồng đội. Tới sân bay: chạy về `BOARD_ZONE` và giữ vị trí.
- **Zombie**: như cũ (đuổi thẳng, trượt dọc tường).
- **Boss**: xuất hiện một lần khi người chơi còn ≤ 60 m route tới cổng sân bay; xuất hiện giữa đường băng.
- **Lên máy bay / thắng**: khi boss đã chết và người chơi vào `BOARD_ZONE` → trạng thái `boarding`: các bot còn sống tự chạy vào vùng; sau khi tất cả bot còn sống đã vào (hoặc tối đa 8 s) → `escaping` → cảnh cất cánh → `won`. Bot đang gục không kịp đỡ thì bị bỏ lại (HUD ghi số người thoát được).
- Hiệu năng va chạm: tường nhiều (~150 box) → đưa tường vào `SpatialGrid` tĩnh để truy vấn tường gần cho va chạm; `castShot` chỉ xét tường trong ô mà tia đi qua (hoặc giới hạn theo tầm 20 m).

## Hiển thị (Minecraft)
- Công trình voxel từ `src/render/voxel.ts` (texture pixel 16×16, InstancedMesh theo loại khối): nhà gỗ, cửa hàng gạch/kính có mái hiên len, chung cư bê tông trắng/đá có cửa sổ kính theo tầng, công viên cỏ + cây sồi + hoa.
- Đường: sỏi/đá, vỉa hè đá phiến, vạch sang đường khối trắng, đèn đường (cọc hàng rào + glowstone), vài xe hơi khối bỏ hoang (vật cản trang trí có va chạm box).
- Sân bay: đường băng khối bê tông xám + vạch trắng, tháp điều khiển nhiều tầng có kính, hàng rào sắt, máy bay khối (thân trắng, cánh, đuôi, cửa sổ xanh, động cơ) dài ~24 m.
- Cảnh cất cánh: camera chuyển sang nhìn từ ngoài (góc thứ ba) bám máy bay; máy bay chạy đà dọc đường băng ~4 s rồi ngóc lên bay khỏi thành phố ~4 s; zombie đuổi theo phía sau; màn "ĐÃ THOÁT KHỎI THÀNH PHỐ!" + thời gian, số zombie hạ, số người thoát.

## HUD điều hướng
- **Minimap** (canvas 200×200, góc trên phải, xoay theo hướng nhìn — hướng lên là hướng đang nhìn): công trình (khối xám), đường, route (nét đứt vàng), người chơi (mũi tên giữa), bot (chấm màu áo), zombie trong 40 m (chấm đỏ), boss (chấm đỏ to), sân bay (biểu tượng máy bay) ở mép khi ngoài tầm.
- **Bản đồ lớn**: giữ phím M → overlay toàn thành phố, bắc hướng lên, có route và vị trí mọi người.
- **La bàn mục tiêu**: thanh ở giữa trên cùng, mũi tên chỉ tới waypoint kế tiếp + chữ "Sân bay · 420m" (khoảng cách còn lại theo route).
- **Dòng nhiệm vụ**: "Đến sân bay" → "Hạ zombie khổng lồ" → "Lên máy bay!".

## Kiểm thử
- Vitest cho `city.ts` (không công trình nào đè lên đường/route/sân bay; route nối liền trên tim đường; xác định theo seed), `routeProgress`, spawner theo route, bot theo route, trigger boss, luồng boarding → escaping → won, bot gục bị bỏ lại.
- Kiểm tra bằng mắt trên localhost:3016: đi từ đầu tới sân bay, minimap/la bàn đúng hướng, cảnh cất cánh.
- 60 fps với ~50 zombie + toàn bộ thành phố (draw calls thấp nhờ instancing).

## Ngoài phạm vi (lần này)
Vào trong nhà/nhặt đồ, xe lái được, âm thanh, mobile.
