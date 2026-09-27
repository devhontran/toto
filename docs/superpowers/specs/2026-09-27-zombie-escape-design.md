# Zombie Escape — Design Spec

Ngày: 2026-09-27 · Trạng thái: chờ owner duyệt

## 1. Tổng quan

Game bắn zombie góc nhìn từ trên xuống (top-down, camera nghiêng), chạy trên trình duyệt PC, host tĩnh trên Vercel.
Người chơi cùng 3 đồng đội bot AI đi từ đầu bản đồ tới điểm thoát ở cuối bản đồ. Trên đường có nhà để núp/hồi phục và xe để cả nhóm lái đi.

| Hạng mục | Quyết định |
|---|---|
| Nền tảng | Chỉ PC (bàn phím + chuột) |
| Chế độ | 1 người chơi + 3 bot AI, không online |
| Camera | Top-down nghiêng, bám theo người chơi / xe |
| Mục tiêu | Thoát khỏi bản đồ |
| Đồ họa | Model low-poly CC0 (Kenney / Quaternius) |
| Stack | Vite + TypeScript + Three.js, không framework UI |
| Vật lý | Va chạm 2D tự viết trên mặt phẳng XZ, không dùng thư viện vật lý |

## 2. Kiến trúc

```
src/
  main.ts
  game/
    Game.ts          vòng lặp: input → update systems (fixed step 60Hz) → render (rAF)
    World.ts         danh sách entity, truy vấn lân cận
    Input.ts         WASD, chuột (raycast xuống mặt đất để lấy điểm ngắm), phím
    CameraRig.ts     camera nghiêng, bám player hoặc xe
  entities/
    Player.ts Bot.ts Zombie.ts Vehicle.ts House.ts Pickup.ts
  systems/
    collision.ts     tròn–tròn, tròn–hộp (AABB/OBB), đẩy tách chồng lấn
    combat.ts        đạn hitscan (raycast 2D), sát thương, knockback
    spatialGrid.ts   lưới băm không gian cho truy vấn lân cận
    navigation.ts    lưới ô + A* để đi vòng quanh nhà/xe
    spawner.ts       sinh zombie theo khu vực phía trước người chơi
  ai/
    botBrain.ts      FSM: follow / engage / revive / enterVehicle / enterHouse
    zombieBrain.ts   FSM: wander / alerted / chase / attack / breakDoor
  level/
    map.ts           bố cục bản đồ dạng dữ liệu
    assets.ts        nạp .glb, clone skinned mesh, AnimationMixer
  ui/
    hud.ts           HTML overlay
public/models/       .glb đã nén + CREDITS.md
```

Nguyên tắc:
- Mỗi entity tách **state logic** (vị trí x/z, hướng, máu, trạng thái) khỏi **view** (Object3D). Logic không import Three.js ngoài kiểu toán học → test được bằng Vitest.
- Update logic ở bước thời gian cố định 1/60s (accumulator); render theo rAF.
- Zombie số lượng lớn: chia sẻ geometry/material, skeleton clone qua `SkeletonUtils.clone`; nếu không đạt mục tiêu hiệu năng thì chuyển sang instancing + baked animation.

## 3. Gameplay

### Nhịp một ván
- Bản đồ: 1 con đường thị trấn dài ~300m, 5–6 nhà hai bên, 2–3 xe đỗ rải rác.
- Zombie sinh phía trước, ngoài tầm camera; mật độ tăng dần theo tiến độ.
- Đoạn cuối: đường bị rào chắn (xe không qua được), phải đi bộ tới vùng thoát.
- Vùng thoát: đứng trong vùng 20 giây (chờ trực thăng) trong khi zombie tràn tới → thắng.
- Thua: cả người chơi và 3 bot đều gục cùng lúc.
- Thời lượng mục tiêu: 3–5 phút.

### Người chơi
- WASD di chuyển; nhân vật quay theo chuột; giữ chuột trái bắn; R nạp đạn; E lên/xuống xe; 1/2/3 đổi súng.
- 100 máu, không tự hồi. Hết máu → gục; bot đứng cạnh 3 giây để đỡ dậy (hồi 30 máu).

### Súng

| Súng | Sát thương | Tốc độ bắn | Băng đạn | Ghi chú |
|---|---|---|---|---|
| Súng lục | 25 | 4 phát/giây | 12 | Đạn dự trữ vô hạn, có sẵn từ đầu |
| Shotgun | 6 viên × 15 | 1 phát/giây | 6 | Bắn tỏa ±15°, knockback mạnh, nhặt trong nhà |
| Súng trường | 20 | 10 phát/giây | 30 | Đạn dự trữ hữu hạn, nhặt trong nhà |

Tầm bắn: 20m. Nạp đạn: 1,5 giây.

### Zombie

| Loại | Máu | Tốc độ | Xuất hiện |
|---|---|---|---|
| Thường | 60 | 2 m/s | Suốt bản đồ |
| Chạy nhanh | 30 | 5 m/s | Tăng dần về cuối bản đồ |

- Đòn đánh: 10 sát thương, hồi chiêu 1 giây, tầm 1m.
- Nghe tiếng súng trong bán kính 25m → chuyển sang đuổi nguồn phát.
- Tìm đường bằng A* khi bị nhà/xe chắn; khi đã thấy mục tiêu trực tiếp thì đi thẳng.

### Xe
- Lái arcade: W/S tăng tốc/lùi, A/D bẻ lái; tốc độ tối đa ~15 m/s.
- 4 chỗ: người chơi lái, bot tự chạy tới leo lên và bắn ra ngoài (súng lục, tầm 15m).
- 300 máu. Đâm zombie ở tốc độ > 5 m/s → zombie chết ngay, xe mất 5 máu mỗi con. Zombie bám xe gây sát thương lên xe.
- Hết máu → bốc khói, dừng hẳn, cả nhóm bị đẩy xuống.

### Nhà
- Khi có nhân vật ở trong: mái và tường phía camera mờ dần (opacity).
- Mỗi nhà 1 cửa, cửa 150 máu. Zombie phải phá cửa mới vào được; cửa bị phá thì mở vĩnh viễn.
- Mỗi nhà 1–2 vật phẩm (nhặt 1 lần): hộp máu (+50), hộp đạn (+1 băng cho súng hiện tại), hoặc súng mới.

### Bot (3 đồng đội)
- **follow**: giữ đội hình quanh người chơi, cách 3–5m.
- **engage**: bắn zombie gần nhất trong tầm 15m; tốc độ bắn bằng 70% và độ lệch ngắm ±5° so với người chơi.
- **revive**: đỡ dậy người chơi hoặc bot khác đang gục.
- **enterVehicle** / **enterHouse**: làm theo khi người chơi lên xe hoặc vào nhà.
- 100 máu; gục thì người chơi đứng cạnh 3 giây để đỡ dậy.

### HUD
- Máu người chơi và 3 bot, súng hiện tại + số đạn, máu xe (khi đang lái), mũi tên chỉ hướng điểm thoát.
- Màn thắng/thua: thời gian chơi, số zombie đã hạ, nút chơi lại.

## 4. Asset
- Nguồn: pack CC0 của Quaternius và Kenney. Pack cụ thể được chọn khi tải, với điều kiện có đủ animation cần dùng: idle, walk, run, shoot, die (nhân vật); walk, attack, die (zombie).
- Nhân vật người chơi và bot dùng chung model, phân biệt bằng màu. Zombie dùng model riêng.
- Tối ưu bằng gltf-transform (meshopt hoặc Draco, tối đa texture 1024px).
- Ghi nguồn và giấy phép từng pack vào `public/models/CREDITS.md`.

## 5. Kiểm thử và hiệu năng
- Vitest cho logic thuần: collision, spatialGrid, A*, combat, botBrain, zombieBrain.
- Kiểm tra hình ảnh: chụp màn hình trên localhost:3016 sau mỗi mốc.
- `?debug` bật bảng FPS, hiển thị collider và lưới nav.
- Mục tiêu hiệu năng: 60fps với 100 zombie trên màn hình, trên laptop tầm trung.
- `pnpm build` phải qua (tsc + vite) trước mỗi lần deploy.

## 6. Mốc thực hiện
1. **Nền tảng:** bản đồ dựng bằng khối hình học, di chuyển, bắn, zombie đuổi, va chạm, HUD máu và đạn.
2. **Bot:** 3 đồng đội follow/engage/revive, thắng/thua.
3. **Nhà:** cửa phá được, mái mờ, vật phẩm, zombie tìm đường vòng bằng A*.
4. **Xe:** lái, lên/xuống cả nhóm, đâm zombie, xe hỏng.
5. **Asset:** thay khối hình học bằng model + animation.
6. **Hoàn thiện:** cân bằng độ khó, đợt tràn ở vùng thoát, tối ưu hiệu năng, deploy Vercel.

## 7. Ngoài phạm vi bản 1
Âm thanh, nhiều bản đồ, lưu điểm, điều khiển mobile, multiplayer online.
