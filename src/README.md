# `src`

Dokumen ini menjelaskan pembagian tanggung jawab kode di dalam `src/`,
bukan daftar lengkap setiap file. Untuk gambaran aplikasi secara umum
(instalasi, run, build), lihat `frontend/README.md`.

## Entry point & routing

`main.jsx` me-mount `App.jsx`. Tidak ada React Router — `App.jsx` hanya
menyimpan satu state `activePage` (`"fdsn"` | `"local"`) dan me-render dua
halaman (`FdsnViewer`, `LocalFileViewer`) **sekaligus**, menyembunyikan yang
tidak aktif lewat class CSS (`viewer-page-hidden`). Ini disengaja agar state
per sumber data (waveform yang sudah dimuat, pipeline processing, dsb.)
tidak hilang saat user berpindah tab.

## Pages (`src/pages/`)

Halaman/panel level fitur, masing-masing memegang state utama untuk alurnya:

- **`FdsnViewer.jsx`** — form request FDSN (network/station/location/
  channel/waktu), memuat daftar station (`fetch` langsung ke
  `/api/stations`, bukan lewat `api/stationApi.js`), dan mengorkestrasi
  3 fase pemuatan waveform (cek cache → download bila perlu → ambil data)
  untuk satu atau banyak station sekaligus.
- **`LocalFileViewer.jsx`** — alur upload MiniSEED (+ StationXML opsional),
  mengelola lifecycle `session_id` backend (dibuat saat upload, diganti
  saat dataset baru diunggah, dihapus saat "Clear").
- **`WaveformViewerPanel.jsx`** — panel terbesar, dipakai oleh kedua halaman
  di atas (menerima `originalWaveform`/`loadedRequest` sebagai props).
  Bertanggung jawab atas: pemilihan trace aktif, pipeline processing
  (apply ke `POST /process`, undo/redo), kontrol amplitudo, serta
  toggle & fetch untuk tiga panel analisis (Spectrogram/PSD/HVSR) dan
  submenu Download (MiniSEED/StationXML/PNG).

## Components (`src/components/`)

Dikelompokkan menurut fitur; setiap folder komponen umumnya berisi satu
`.jsx` (+ `.css` bila perlu style khusus).

**Form request FDSN** — dipakai oleh `FdsnViewer.jsx`:
`NetworkSelector`, `LocationSelector`, `ChannelSelector`, `TimeControl`,
`StationSelectorModal` (modal multi-select station).

**Upload lokal** — dipakai oleh `LocalFileViewer.jsx`: `FileDropZone`
(drag-drop generik, dipakai untuk MiniSEED maupun StationXML).

**Panel waveform** — dipakai oleh `WaveformViewerPanel.jsx`:
- `WaveformPlot` — rendering plot waveform per trace (Plotly).
- `TraceSelectorMatrix` — matrix pilihan trace aktif per station/channel.
- `AmplitudeControl` — kontrol skala amplitudo & toggle normalize.
- `ProcessingPipeline` — editor pipeline operation (trim/filter/instrument
  correction), termasuk `NumberField` sebagai input numerik yang menerima
  string kosong/parsial sebelum dikonversi ke `Number()` saat submit.
- `SpectrogramPanel`, `PSDPanel`, `HVSRPanel` — menampilkan gambar hasil
  analisis (base64 PNG) per trace/family dari backend.

**Tidak terpakai (dead code)** — ada di source tapi tidak diimpor oleh
`App.jsx` atau `pages/` mana pun; hanya dirujuk dari `WaveformViewer.jsx`
(yang sendiri juga tidak diimpor di manapun):
`WaveformViewer.jsx` (+ `WaveformViewer.css`), `components/TraceSelector/`,
`components/StationSelector/` (folder, bukan modal), dan
`components/Toolbar/`. Jangan menganggap ini bagian dari alur aplikasi
aktif.

## Hooks (`src/hooks/`)

Satu custom hook: **`useOperationStack`** — mengelola pipeline processing
sebagai draft (`pipeline`) terpisah dari riwayat ter-commit (`history` +
`pointer`), menyediakan `addOperation`/`updateOperation`/`removeOperation`
untuk mengedit draft, `commit` untuk menyimpan snapshot baru ke history,
serta `undo`/`redo` untuk berpindah antar snapshot. Dipakai satu-satunya
oleh `WaveformViewerPanel.jsx`.

## Services / API (`src/api/`)

Wrapper tipis di atas `axios`, dikelompokkan per domain, bukan satu client
generik:

- `healthApi.js` — `GET /health`.
- `stationApi.js` — `GET /api/stations` + turunannya (`getNetworks`,
  `getStationsByNetwork`, filter di sisi frontend dari hasil yang sama).
- `waveformApi.js` — waveform FDSN (`getChannels`, `getWaveform`,
  `checkWaveformCache`, `downloadWaveform`), pipeline processing
  (`postProcess`), analisis (`getSpectrogram`, `getPSD`, `getHVSR`), dan
  export (`downloadStationXML`, `downloadMiniSeed`, termasuk logika
  pemicu unduhan file di browser). Juga mengekspor konstanta `MAX_POINTS`
  (75000) yang dikirim sebagai `max_points` ke backend untuk decimation.
- `uploadApi.js` — siklus upload lokal (`uploadMiniSeed`, `uploadStationXML`,
  `validateStationXML`, `deleteUploadSession`, `getUploadWaveform`).

Base URL backend (`http://127.0.0.1:8000`) di-hardcode berulang di setiap
file di atas (bukan konstanta bersama/env variable).

## State management

Tidak ada state management global (Redux/Context API lintas halaman/dll).
Setiap halaman (`FdsnViewer`, `LocalFileViewer`, `WaveformViewerPanel`)
memegang state lokalnya sendiri lewat `useState`/`useRef`, dan
`WaveformViewerPanel` menerima data waveform dari halaman pemanggil via
props (`originalWaveform`, `loadedRequest`, dsb.), bukan lewat context.
Satu-satunya state yang diekstrak ke hook bersama adalah pipeline
processing (`useOperationStack`), dan itu pun dipakai secara lokal oleh
`WaveformViewerPanel` — bukan dibagikan lintas komponen lain.

## Utils (`src/utils/`)

Fungsi murni tanpa side effect (tidak memanggil API):

- `dateTime.js` — format `Date` ke string lokal `YYYY-MM-DDTHH:MM` dan
  helper rentang waktu default.
- `traceIdentity.js` — membentuk `traceId` sintetis per trace
  (`network.station.location.channel.segment_index`) dari respons backend,
  dipakai sebagai key seleksi/rendering di seluruh UI.
- `processingPayload.js` — mengonversi operation di editor pipeline
  (`ProcessingPipeline`) menjadi payload yang sesuai schema backend
  (`app/models/processing.py`) sebelum dikirim ke `POST /process`.

## Alur data: UI → API → processing → rendering

1. **Input** — user mengisi form di `FdsnViewer`/`LocalFileViewer`
   (component-component selector/`FileDropZone`) → state lokal halaman.
2. **Request awal** — halaman memanggil fungsi di `api/waveformApi.js`
   atau `api/uploadApi.js`; hasil (`traces`) diberi `traceId` lewat
   `utils/traceIdentity.js`, lalu disimpan sebagai `originalWaveform` +
   `loadedRequest` dan diteruskan sebagai props ke `WaveformViewerPanel`.
3. **Tampilan awal** — `WaveformViewerPanel` memilih trace aktif
   (`TraceSelectorMatrix`) dan merender waveform mentah lewat
   `WaveformPlot` (Plotly), dengan `amplitudeScale`/`normalizeEnabled`
   sebagai state tampilan murni (tidak memengaruhi data yang diproses).
4. **Processing (opsional)** — user menyusun operation di
   `ProcessingPipeline`; state draft dikelola `useOperationStack`. Saat
   di-apply, `utils/processingPayload.js` mengonversi pipeline menjadi
   payload, dikirim via `postProcess` (`POST /process`), dan hasilnya
   menggantikan `originalWaveform` sebagai `processedWaveform` yang
   dirender ulang oleh `WaveformPlot`.
5. **Analisis lanjutan (opsional)** — mengaktifkan toggle Spectrogram/PSD/
   HVSR memicu `useEffect` di `WaveformViewerPanel` yang memanggil
   `getSpectrogram`/`getPSD`/`getHVSR` per trace/family aktif, menyimpan
   hasil base64 PNG di state (`spectrograms`/`psds`/`hvsrs`), lalu
   dirender oleh `SpectrogramPanel`/`PSDPanel`/`HVSRPanel`.
6. **Output** — dari panel yang sama, user dapat mengekspor data
   (`downloadMiniSeed`/`downloadStationXML` ke backend) atau gambar plot
   (PNG waveform via `Plotly.toImage` di browser; PNG spectrogram/PSD/HVSR
   langsung dari base64 yang sudah ada di state, tanpa request baru).