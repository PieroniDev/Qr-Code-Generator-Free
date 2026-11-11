/* Gerador de QR Code estático: tudo roda no navegador, nada é enviado nem guardado.
   O conteúdo vai gravado no próprio código, então o QR não expira nem depende do site. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const PREVIEW_SIZE = 600;
  const DPI = 300;
  const PLACEHOLDER = "https://seusite.com.br";

  const DEFAULTS = {
    data: "",
    dotsColor: "#000000",
    dotsColor2: "#2b59ff",
    bgColor: "#ffffff",
    cornerColor: "#000000",
    useGradient: false,
    gradientType: "linear",
    customCorners: false,
    transparentBg: false,
    dotType: "square",
    cornerSquareType: "square",
    cornerDotType: "square",
    logo: null,
    logoName: "",
    logoSize: 0.35,
    logoHideDots: true,
    margin: 0.06,
    ecc: "H",
  };

  const DOT_TYPES = [
    ["square", "Quadrado"],
    ["rounded", "Suave"],
    ["extra-rounded", "Redondo"],
    ["dots", "Bolinhas"],
    ["classy", "Elegante"],
    ["classy-rounded", "Folha"],
  ];
  const CORNER_SQUARE_TYPES = [
    ["square", "Reto"],
    ["extra-rounded", "Suave"],
    ["dot", "Círculo"],
  ];
  const CORNER_DOT_TYPES = [
    ["square", "Reto"],
    ["rounded", "Suave"],
    ["dot", "Círculo"],
  ];

  const state = { ...DEFAULTS };
  let eccBeforeLogo = DEFAULTS.ecc;

  /* ---------- conteúdo ---------- */

  // Quem digita "meusite.com.br" quer um link; sem o https:// muitos leitores tratam como texto puro.
  function normalizeData(raw) {
    const text = raw.trim();
    if (!text) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text; // já tem esquema (https:, mailto:, tel:, WIFI:...)
    if (/^(www\.)?[^\s@/]+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return "https://" + text;
    return text;
  }

  /* ---------- opções da biblioteca ---------- */

  function buildOptions(size, { data, opaqueBg = false } = {}) {
    const gradient = state.useGradient
      ? {
          type: state.gradientType,
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: state.dotsColor },
            { offset: 1, color: state.dotsColor2 },
          ],
        }
      : undefined;

    const corner = state.customCorners
      ? { color: state.cornerColor, gradient: undefined }
      : { color: state.dotsColor, gradient };

    // JPG não tem transparência: se o fundo for transparente, sai branco.
    const bg = state.transparentBg ? (opaqueBg ? "#ffffff" : "transparent") : state.bgColor;

    return {
      width: size,
      height: size,
      margin: Math.round(size * state.margin),
      data,
      image: state.logo || undefined,
      qrOptions: { errorCorrectionLevel: state.ecc },
      imageOptions: {
        hideBackgroundDots: state.logoHideDots,
        imageSize: state.logoSize,
        margin: Math.round(size * 0.008),
        crossOrigin: "anonymous",
      },
      dotsOptions: { type: state.dotType, color: state.dotsColor, gradient },
      cornersSquareOptions: { type: state.cornerSquareType, ...corner },
      cornersDotOptions: { type: state.cornerDotType, ...corner },
      backgroundOptions: { color: bg },
    };
  }

  /* ---------- pré-visualização ---------- */

  const preview = $("preview");
  const qr = new QRCodeStyling({ ...buildOptions(PREVIEW_SIZE, { data: PLACEHOLDER }), type: "svg" });
  qr.append($("qr"));

  function render() {
    const data = normalizeData(state.data);
    preview.dataset.empty = String(!data);

    const hint = $("dataHint");
    hint.innerHTML = "";
    if (data && data !== state.data.trim()) {
      hint.append("Será gravado como ");
      const code = document.createElement("code");
      code.textContent = data;
      hint.append(code);
    }

    let error = "";
    try {
      qr.update(buildOptions(PREVIEW_SIZE, { data: data || PLACEHOLDER }));
    } catch (e) {
      error = state.ecc === "L"
        ? "Texto longo demais para caber em um QR Code. Encurte o conteúdo."
        : "Texto longo demais para este nível de correção. Encurte o conteúdo ou baixe a correção de erros.";
    }

    const tooLong = Boolean(error);
    document.querySelectorAll("[data-format]").forEach((b) => (b.disabled = !data || tooLong));
    showWarning(error || contrastWarning());
  }

  let renderTimer = 0;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  }

  /* ---------- aviso de leitura (contraste) ---------- */

  function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastWarning() {
    const fg = [state.dotsColor];
    if (state.useGradient) fg.push(state.dotsColor2);
    if (state.customCorners) fg.push(state.cornerColor);
    const lumFg = fg.map(luminance);

    if (state.transparentBg) {
      return Math.max(...lumFg) > 0.4
        ? "Pontos claros com fundo transparente podem sumir se o QR for colocado sobre fundo claro."
        : "";
    }

    const lumBg = luminance(state.bgColor);
    if (lumFg.some((l) => l > lumBg)) {
      return "Pontos mais claros que o fundo: alguns leitores de QR não conseguem ler. Teste com a câmera antes de imprimir.";
    }
    const worst = Math.min(...lumFg.map((l) => (lumBg + 0.05) / (l + 0.05)));
    return worst < 3
      ? "Pouco contraste entre os pontos e o fundo: o QR pode não ser lido. Escureça os pontos ou clareie o fundo."
      : "";
  }

  function showWarning(text) {
    const el = $("warning");
    el.textContent = text;
    el.hidden = !text;
  }

  /* ---------- miniaturas dos estilos ---------- */

  // Cada miniatura é um QR real desenhado pela biblioteca, recortado (viewBox) na região que interessa:
  // o miolo para os pontos e o canto superior esquerdo para a moldura e o centro.
  function buildStylePicker(containerId, types, key, thumbOptions, viewBox) {
    const container = $(containerId);
    types.forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "style-option";
      button.setAttribute("role", "radio");
      button.dataset.value = value;

      const thumb = document.createElement("span");
      thumb.className = "style-thumb";
      thumb.setAttribute("aria-hidden", "true");
      const mini = new QRCodeStyling({
        type: "svg",
        width: 210,
        height: 210,
        margin: 0,
        data: "Q",
        qrOptions: { errorCorrectionLevel: "L" }, // 21×21 módulos de 10 px
        backgroundOptions: { color: "transparent" },
        ...thumbOptions(value),
      });
      mini.append(thumb);
      const svg = thumb.querySelector("svg");
      if (svg) {
        svg.setAttribute("viewBox", viewBox);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      }

      button.append(thumb, label);
      button.addEventListener("click", () => {
        state[key] = value;
        syncPicker(containerId, key);
        scheduleRender();
      });
      container.append(button);
    });

    // setas do teclado entre as opções, como um grupo de rádio
    container.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const options = [...container.children];
      const i = options.findIndex((o) => o.dataset.value === state[key]);
      const next = options[(i + dir + options.length) % options.length];
      next.click();
      next.focus();
    });
  }

  function syncPicker(containerId, key) {
    [...$(containerId).children].forEach((b) => {
      const on = b.dataset.value === state[key];
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  const INK = "#111111";
  buildStylePicker("dotStyles", DOT_TYPES, "dotType",
    (v) => ({ dotsOptions: { type: v, color: INK }, cornersSquareOptions: { color: INK }, cornersDotOptions: { color: INK } }),
    "80 80 50 50");
  buildStylePicker("cornerSquareStyles", CORNER_SQUARE_TYPES, "cornerSquareType",
    (v) => ({ dotsOptions: { color: "transparent" }, cornersSquareOptions: { type: v, color: INK }, cornersDotOptions: { type: "square", color: "#b9b6ae" } }),
    "-5 -5 80 80");
  buildStylePicker("cornerDotStyles", CORNER_DOT_TYPES, "cornerDotType",
    (v) => ({ dotsOptions: { color: "transparent" }, cornersSquareOptions: { type: "square", color: "#cfccc4" }, cornersDotOptions: { type: v, color: INK } }),
    "-5 -5 80 80");

  /* ---------- formulário ↔ estado ---------- */

  const colorKeys = ["dotsColor", "dotsColor2", "bgColor", "cornerColor"];

  function setColor(key, value) {
    state[key] = value.toLowerCase();
    $(key).value = state[key];
    const hex = document.querySelector(`.hex[data-for="${key}"]`);
    if (document.activeElement !== hex) hex.value = state[key].toUpperCase();
  }

  function syncForm() {
    $("data").value = state.data;
    colorKeys.forEach((k) => setColor(k, state[k]));
    $("useGradient").checked = state.useGradient;
    $("gradientType").value = state.gradientType;
    $("customCorners").checked = state.customCorners;
    $("transparentBg").checked = state.transparentBg;
    $("logoSize").value = state.logoSize;
    $("logoHideDots").checked = state.logoHideDots;
    $("margin").value = state.margin;
    $("ecc").value = state.ecc;
    syncVisibility();
    syncPicker("dotStyles", "dotType");
    syncPicker("cornerSquareStyles", "cornerSquareType");
    syncPicker("cornerDotStyles", "cornerDotType");
  }

  function syncVisibility() {
    $("gradientColorField").hidden = !state.useGradient;
    $("gradientType").hidden = !state.useGradient;
    $("cornerColorField").hidden = !state.customCorners;
    $("bgColor").closest(".color-field").classList.toggle("is-off", state.transparentBg);
    $("bgColor").disabled = state.transparentBg;
    document.querySelector('.hex[data-for="bgColor"]').disabled = state.transparentBg;

    const hasLogo = Boolean(state.logo);
    $("logoRemove").hidden = !hasLogo;
    $("logoSizeField").hidden = !hasLogo;
    $("logoHideField").hidden = !hasLogo;
    $("logoLabel").textContent = hasLogo ? state.logoName || "Trocar imagem" : "Escolher imagem";
    // o logo cobre parte dos pontos; só a correção máxima garante a leitura
    $("ecc").disabled = hasLogo;
    $("ecc").title = hasLogo ? "Com logo a correção fica no máximo para o QR continuar legível." : "";

    $("logoSizeOut").textContent = Math.round(state.logoSize * 100) + "%";
    $("marginOut").textContent = Math.round(state.margin * 100) + "%";
  }

  $("data").addEventListener("input", (e) => {
    state.data = e.target.value;
    scheduleRender();
  });

  colorKeys.forEach((key) => {
    $(key).addEventListener("input", (e) => {
      setColor(key, e.target.value);
      scheduleRender();
    });
  });

  document.querySelectorAll(".hex").forEach((input) => {
    input.addEventListener("input", () => {
      const v = input.value.trim();
      if (/^#?[0-9a-f]{6}$/i.test(v)) {
        setColor(input.dataset.for, v.startsWith("#") ? v : "#" + v);
        scheduleRender();
      }
    });
    input.addEventListener("blur", () => (input.value = state[input.dataset.for].toUpperCase()));
  });

  ["useGradient", "customCorners", "transparentBg", "logoHideDots"].forEach((key) => {
    $(key).addEventListener("change", (e) => {
      state[key] = e.target.checked;
      // ao separar a cor dos cantos, começa da cor atual dos pontos
      if (key === "customCorners" && state.customCorners) setColor("cornerColor", state.dotsColor);
      syncVisibility();
      scheduleRender();
    });
  });

  $("gradientType").addEventListener("change", (e) => {
    state.gradientType = e.target.value;
    scheduleRender();
  });

  [["logoSize", "logoSize"], ["margin", "margin"]].forEach(([id, key]) => {
    $(id).addEventListener("input", (e) => {
      state[key] = Number(e.target.value);
      syncVisibility();
      scheduleRender();
    });
  });

  $("ecc").addEventListener("change", (e) => {
    state.ecc = e.target.value;
    scheduleRender();
  });

  $("logoFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!state.logo) eccBeforeLogo = state.ecc;
      state.logo = reader.result;
      state.logoName = file.name;
      state.ecc = "H";
      $("ecc").value = "H";
      syncVisibility();
      render();
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
  });

  $("logoRemove").addEventListener("click", () => {
    state.logo = null;
    state.logoName = "";
    state.ecc = eccBeforeLogo;
    $("ecc").value = state.ecc;
    syncVisibility();
    render();
  });

  $("reset").addEventListener("click", () => {
    const data = state.data; // restaura o visual, não apaga o que a pessoa digitou
    Object.assign(state, DEFAULTS, { data });
    syncForm();
    render();
  });

  /* ---------- download ---------- */

  function fileName() {
    const slug = normalizeData(state.data)
      .replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, "")
      .replace(/^www\./i, "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .toLowerCase();
    return "qrcode" + (slug ? "-" + slug : "");
  }

  async function makeFile(format, size) {
    const data = normalizeData(state.data);

    if (format === "svg") {
      const svgQr = new QRCodeStyling({ ...buildOptions(size, { data }), type: "svg" });
      return svgQr.getRawData("svg");
    }

    const canvasQr = new QRCodeStyling({ ...buildOptions(size, { data, opaqueBg: format === "jpg" }), type: "canvas" });
    const png = await canvasQr.getRawData("png");
    if (format === "png") return setPngDpi(png, DPI);

    // JPG: redesenha o PNG num canvas com qualidade alta (o padrão da biblioteca é 0.92 e borra as bordas)
    const bitmap = await createImageBitmap(png);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const jpg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.98));
    return setJpegDpi(jpg, DPI);
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", async () => {
      const format = button.dataset.format;
      const label = button.textContent;
      button.disabled = true;
      button.textContent = "Gerando…";
      try {
        const blob = await makeFile(format, Number($("exportSize").value));
        save(blob, `${fileName()}.${format}`);
      } catch (e) {
        console.error(e);
        showWarning("Não foi possível gerar o arquivo. Tente um tamanho menor ou outra imagem de logo.");
      } finally {
        button.textContent = label;
        button.disabled = false;
      }
    });
  });

  /* ---------- 300 dpi nos arquivos (o canvas salva sem essa informação, e gráficas olham isso) ---------- */

  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });

  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function setPngDpi(blob, dpi) {
    const src = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(src.buffer);

    // se já houver um bloco pHYs, deixa como está
    for (let pos = 8; pos < src.length - 8; ) {
      const len = view.getUint32(pos);
      const type = String.fromCharCode(...src.subarray(pos + 4, pos + 8));
      if (type === "pHYs") return blob;
      if (type === "IDAT") break;
      pos += 12 + len;
    }

    const ppm = Math.round(dpi / 0.0254); // pixels por metro
    const chunk = new Uint8Array(21);
    const cv = new DataView(chunk.buffer);
    cv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    cv.setUint32(8, ppm);
    cv.setUint32(12, ppm);
    chunk[16] = 1; // unidade: metro
    cv.setUint32(17, crc32(chunk.subarray(4, 17)));

    const IHDR_END = 33; // assinatura (8) + bloco IHDR (25)
    return new Blob([src.subarray(0, IHDR_END), chunk, src.subarray(IHDR_END)], { type: "image/png" });
  }

  async function setJpegDpi(blob, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const isJfif = bytes[2] === 0xff && bytes[3] === 0xe0 &&
      String.fromCharCode(...bytes.subarray(6, 10)) === "JFIF";
    if (!isJfif) return blob;
    bytes[13] = 1; // unidade: pontos por polegada
    bytes[14] = dpi >> 8; bytes[15] = dpi & 0xff;
    bytes[16] = dpi >> 8; bytes[17] = dpi & 0xff;
    return new Blob([bytes], { type: "image/jpeg" });
  }

  /* ---------- início ---------- */

  syncForm();
  render();
  $("data").focus({ preventScroll: true });
})();
