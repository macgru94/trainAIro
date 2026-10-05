// Etykiety odczuć – używane zarówno na serwerze, jak i w przeglądarce.

// Skala samopoczucia w intervals.icu: 1 = najlepiej, 5 = najgorzej.
export const FEEL_LABELS: Record<number, string> = {
  1: "Bardzo dobrze",
  2: "Dobrze",
  3: "Normalnie",
  4: "Słabo",
  5: "Bardzo słabo",
};

// RPE – subiektywna ocena wysiłku w skali 1–10.
export const RPE_LABELS: Record<number, string> = {
  1: "Bardzo lekko",
  2: "Lekko",
  3: "Umiarkowanie",
  4: "Dość ciężko",
  5: "Ciężko",
  6: "Ciężko",
  7: "Bardzo ciężko",
  8: "Bardzo ciężko",
  9: "Ekstremalnie ciężko",
  10: "Maksymalny wysiłek",
};
