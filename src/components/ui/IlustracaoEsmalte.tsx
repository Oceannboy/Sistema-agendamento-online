/**
 * Ilustração do esmalte em traço branco (telas 1, 2 e cadastro).
 * É um SVG provisório inspirado no mockup. Para trocar pelo arquivo final,
 * basta substituir o conteúdo deste componente (ou usar <Image> apontando
 * para o arquivo em /public) mantendo a mesma assinatura.
 */

function pontosEstrela(cx: number, cy: number, raio: number): string {
  const pontos: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.45;
    const angulo = (Math.PI / 5) * i - Math.PI / 2;
    pontos.push(
      `${(cx + r * Math.cos(angulo)).toFixed(1)},${(cy + r * Math.sin(angulo)).toFixed(1)}`,
    );
  }
  return pontos.join(" ");
}

export function IlustracaoEsmalte({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 255"
      className={className}
      fill="none"
      stroke="#ffffff"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* frasco: tampa rosqueada */}
      <ellipse cx="199" cy="12" rx="32" ry="9" />
      <ellipse cx="199" cy="12" rx="20" ry="5" />
      <path d="M167 12 V60 M231 12 V60" />
      <path d="M167 28 A32 9 0 0 0 231 28" strokeDasharray="16 5" />
      <path d="M167 44 A32 9 0 0 0 231 44" strokeDasharray="16 5" />
      <path d="M167 60 A32 9 0 0 0 231 60" />

      {/* frasco: corpo */}
      <ellipse cx="199" cy="67" rx="51" ry="14" />
      <path d="M148 67 V212 M250 67 V212" />
      <path d="M148 212 A51 14 0 0 0 250 212" />
      <path d="M168 86 L166 192" strokeDasharray="62 8 24" />
      <path d="M187 90 L186 203" strokeDasharray="70 8 24" />
      <path d="M209 90 L209 203" strokeDasharray="70 8 24" />
      <path d="M230 86 L232 192" strokeDasharray="62 8 24" />

      {/* tampa deitada */}
      <g transform="translate(70 150) rotate(32)">
        <rect x="-64" y="-26" width="118" height="52" rx="12" />
        <ellipse cx="54" cy="0" rx="12" ry="26" />
        <ellipse cx="54" cy="0" rx="6.5" ry="17" />
        <path d="M-52 -14 H40 M-52 -5 H40 M-52 5 H40 M-52 14 H40" strokeDasharray="22 7" />
      </g>

      {/* pincel */}
      <path d="M90 170 L153 209" />
      <path d="M86 178 L149 217" />
      <path d="M153 209 L156 214 L149 217" />
      <path d="M153 213 L210 244 M155 214 L214 236 M152 216 L204 250 M156 212 L216 228" strokeWidth={2.2} />

      {/* brilhos */}
      <polygon points={pontosEstrela(90, 70, 18)} fill="#ffffff" strokeWidth={1} />
      <polygon points={pontosEstrela(127, 41, 8)} fill="#ffffff" strokeWidth={1} />
    </svg>
  );
}
