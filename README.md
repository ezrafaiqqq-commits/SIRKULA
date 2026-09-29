# SIRKULA — Live Waste Tracking

Versi ini menambahkan:
- Browser camera
- COCO-SSD object detection
- Multi-object tracking berbasis IoU + Tracking ID
- Duplicate guard: satu ID hanya masuk accumulator sekali
- Automatic material mapping
- Session accumulator per material
- Estimasi berat
- XP dan impact score
- LocalStorage untuk menyimpan sesi terakhir

## Menjalankan
Karena kamera browser membutuhkan secure context:
1. Buka folder ini di VS Code.
2. Jalankan dengan Live Server, atau server lokal lain.
3. Buka `http://localhost/...`.
4. Klik AKTIFKAN KAMERA.
5. Beri izin kamera.

## Catatan AI
Model yang dipakai adalah COCO-SSD umum dari TensorFlow.js. Ini BELUM merupakan custom-trained waste model. Mapping ke kategori sampah dilakukan setelah object detection.

Untuk versi lomba yang benar-benar custom:
- kumpulkan dataset foto sampah Indonesia,
- anotasi bounding box,
- train YOLO/RT-DETR/custom classifier,
- deploy model TensorFlow.js/ONNX/TFLite,
- tambahkan tracking seperti ByteTrack/DeepSORT,
- dan validasi precision/recall per kelas.

## Kelas demo
Plastic, Paper, Glass, Metal, Organic, B3/E-waste.
Tidak semua kelas dapat dideteksi langsung oleh COCO-SSD; hanya objek COCO yang dipetakan akan masuk accumulator.
