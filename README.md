# Frontend — Interactive Seismogram Viewer

Aplikasi web untuk memuat, memvisualisasikan, dan memproses data waveform
seismik. Data bisa diambil dari server FDSN BMKG maupun diunggah manual
(MiniSEED + StationXML), lalu ditampilkan sebagai plot interaktif dengan
pipeline pemrosesan (trim, filter, instrument correction) serta analisis
tambahan (spectrogram, PSD, HVSR).

## Instalasi

```bash
npm install
```

## Menjalankan development server

```bash
npm run dev
```

Vite menjalankan dev server (default port 5173, lihat `vite.config.js`).
Backend FastAPI diasumsikan berjalan di `http://127.0.0.1:8000` — URL ini
saat ini di-hardcode langsung di setiap file `src/api/*.js`, bukan dibaca
dari environment variable.

## Build

```bash
npm run build
```

Output build production dari Vite (`vite build`). `npm run preview` dapat
dipakai untuk melihat hasil build tersebut secara lokal, dan `npm run lint`
menjalankan ESLint sesuai `eslint.config.js`.

## Tech stack

- **React 19** + **Vite** (`@vitejs/plugin-react`) sebagai build tool/dev
  server.
- **axios** — HTTP client untuk semua pemanggilan API backend.
- **plotly.js-dist-min** + **react-plotly.js** — rendering plot waveform,
  spectrogram, PSD, dan HVSR.
- Tidak ada router (hanya satu halaman dengan tab internal), tidak ada
  library state management eksternal (Redux/Zustand/dll.) — state
  dikelola dengan `useState`/`useRef`/`useMemo` React biasa dan satu custom
  hook (`useOperationStack`).
- Styling murni CSS per-komponen/halaman (`*.css`), tanpa CSS framework.

## Struktur utama `src/`

```text
src/
├── main.jsx                    # entry point, mount <App />
├── App.jsx                     # top bar + tab switch FDSN / Local File
├── WaveformViewer.jsx           # LEGACY, tidak diimpor di manapun (dead code)
├── pages/                       # halaman/panel utama (lihat src/README.md)
├── components/                  # UI komponen per fitur (lihat src/README.md)
├── hooks/useOperationStack.js   # state pipeline processing (undo/redo)
├── api/                         # wrapper axios per domain (station, waveform,
│                                 # upload, health)
└── utils/                       # helper murni (waktu, payload processing,
                                  # identity trace)
```

Rincian tanggung jawab tiap folder didokumentasikan di `src/README.md`.

## Komunikasi dengan backend

- Semua request memakai `axios` (kecuali `FdsnViewer.jsx` yang memanggil
  `fetch` langsung untuk memuat daftar station).
- Base URL backend (`http://127.0.0.1:8000`) di-hardcode di masing-masing
  file `src/api/*.js` — tidak ada file konfigurasi environment (`.env`)
  untuk base URL di frontend saat ini.
- Endpoint yang dipanggil (lihat `src/api/waveformApi.js`,
  `src/api/uploadApi.js`, `src/api/stationApi.js`, `src/api/healthApi.js`):
  `GET /health`, `GET /api/stations`, `GET /api/channels`,
  `GET /api/waveform`, `GET /api/waveform/status`,
  `POST /api/waveform/download`, `POST /process`, `GET /api/spectrogram`,
  `GET /api/psd`, `GET /api/hvsr`, `GET /api/download/stationxml`,
  `POST /api/download/miniseed`, `POST /api/upload/miniseed`,
  `POST /api/upload/stationxml`, `GET /api/upload/stationxml/{session_id}/validation`,
  `GET /api/upload/{session_id}/waveform`, `DELETE /api/upload/{session_id}`.
- Respons waveform dari backend berisi array `traces`; setiap trace diberi
  `traceId` sintetis di frontend (`utils/traceIdentity.js`) dari kombinasi
  network/station/location/channel/segment agar bisa dipilih/ditampilkan
  secara independen di UI.

## Workflow utama aplikasi

1. **Pilih sumber data** — tab **FDSN** (`pages/FdsnViewer.jsx`): pilih
   network, satu/lebih station (via modal `StationSelectorModal`),
   location/channel pattern, dan rentang waktu (`TimeControl`, mode durasi
   atau start–end eksplisit); atau tab **Local File**
   (`pages/LocalFileViewer.jsx`): drag-drop file MiniSEED lalu (opsional)
   StationXML.
2. **Muat waveform**:
   - FDSN: klik *Load Waveform* memicu tiga fase per station —
     cek status cache (`GET /api/waveform/status`), download bila perlu
     (`POST /api/waveform/download`), lalu ambil data untuk ditampilkan
     (`GET /api/waveform`).
   - Local: upload MiniSEED (`POST /api/upload/miniseed`) langsung diikuti
     pengambilan waveform session (`GET /api/upload/{session_id}/waveform`).
3. **Tampilkan** — hasil (`traces`) diteruskan ke `pages/WaveformViewerPanel.jsx`,
   yang merender plot lewat `components/WaveformPlot` (Plotly), dengan
   pemilihan trace aktif via `components/TraceSelectorMatrix`.
4. **Proses (opsional)** — user menyusun operation (`trim`/`filter`/
   `instrument_correction`) di `components/ProcessingPipeline`, disimpan
   sebagai draft pipeline oleh `hooks/useOperationStack`, lalu di-apply
   ke backend lewat `POST /process`; hasil menggantikan tampilan waveform
   (dengan history undo/redo per snapshot pipeline).
5. **Analisis lanjutan (opsional)** — mengaktifkan panel Spectrogram/PSD
   (per trace) atau HVSR (per keluarga komponen N/E/Z satu station) memicu
   pemanggilan `GET /api/spectrogram`, `GET /api/psd`, atau `GET /api/hvsr`
   dan menampilkan hasilnya di `components/SpectrogramPanel`,
   `components/PSDPanel`, `components/HVSRPanel`.
6. **Export (opsional)** — dari panel waveform, user dapat mengunduh
   MiniSEED (`POST /api/download/miniseed`), StationXML
   (`GET /api/download/stationxml`), atau PNG plot (dirender langsung di
   browser via `Plotly.toImage`, tanpa panggilan API).