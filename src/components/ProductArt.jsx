export const A = {
  tote: (
    <g fill="none" stroke="#002fa7" strokeWidth={2}>
      <path d="M25 40h70l8 70H17z" />
      <path d="M42 40c0-30 36-30 36 0" />
      <path d="M40 70h40" strokeDasharray="4 3" />
    </g>
  ),
  pad: (
    <g fill="none" stroke="#002fa7" strokeWidth={2}>
      <rect x={10} y={30} width={100} height={60} rx={8} />
      <path d="M10 50h100M10 70h100M40 30v60M70 30v60" strokeOpacity={0.35} />
    </g>
  ),
  jkt: (
    <g fill="none" stroke="#002fa7" strokeWidth={2}>
      <path d="M45 20l15 10 15-10 30 15 10 40-15 5-5-20v50H30V70l-5 20-15-5 10-40z" />
      <path d="M60 30v70" />
    </g>
  ),
};
A.box = (
  <g fill="none" stroke="#002fa7" strokeWidth={2}>
    <path d="M20 40l40-20 40 20v50l-40 20-40-20z" />
    <path d="M20 40l40 20 40-20M60 60v50" />
  </g>
);
