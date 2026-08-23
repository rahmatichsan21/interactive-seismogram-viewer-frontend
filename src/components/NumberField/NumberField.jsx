import { useEffect, useState } from "react";

function toText(value) {
  return value === null || value === undefined
    ? ""
    : String(value);
}

// Reusable numeric input untuk Processing Pipeline (Frequency,
// Frequency Min, Frequency Max, Corners, dan input angka lain di
// masa depan).
//
// Kenapa komponen ini diperlukan:
// Native <input type="number"> yang value-nya langsung di-bind ke
// state numerik, lalu di-convert lewat Number() di setiap onChange,
// akan memaksa string kosong "" menjadi 0 setiap kali user
// mengetik. Akibatnya field tidak pernah benar-benar bisa kosong,
// dan muncul leading zero yang aneh ("020", "05") saat sedang
// diedit, karena state selalu berupa number murni yang langsung
// dipantulkan balik ke input di tengah proses mengetik.
//
// NumberField menyimpan teks mentah yang sedang diketik user di
// state lokal (boleh kosong, boleh "0", boleh "-", dsb). Konversi
// ke number baru dilakukan ketika user selesai mengetik (onBlur
// atau menekan Enter), lewat callback onCommit. Selama mengetik,
// state milik parent (operation.params.*) tidak pernah menerima
// nilai yang setengah jadi.
function NumberField({
  value,
  onCommit,
  min,
  max,
  step = "any",
  disabled,
  className,
}) {
  const [text, setText] = useState(toText(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sinkronkan teks dari luar (mis. Undo/Redo, atau Add Filter
  // dengan nilai default baru), tapi jangan timpa ketikan user
  // yang sedang berlangsung.
  useEffect(() => {
    if (isFocused) {
      return;
    }

    setText(toText(value));
  }, [value, isFocused]);

  function handleFocus(event) {
    setIsFocused(true);
    event.target.select();
  }

  function handleChange(event) {
    // Biarkan apa adanya selama diketik: boleh kosong, tanpa
    // dipaksa Number() dan tanpa leading zero yang dipaksakan.
    setText(event.target.value);
  }

  function commitText() {
    if (text.trim() === "") {
      // Belum ada angka valid untuk di-commit, kembalikan
      // tampilan ke nilai terakhir yang tersimpan di pipeline.
      setText(toText(value));
      return;
    }

    const nextValue = Number(text);

    if (Number.isNaN(nextValue)) {
      setText(toText(value));
      return;
    }

    setText(toText(nextValue));
    onCommit(nextValue);
  }

  function handleBlur() {
    setIsFocused(false);
    commitText();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.target.blur();
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      min={min}
      max={max}
      step={step}
      value={text}
      disabled={disabled}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export default NumberField;