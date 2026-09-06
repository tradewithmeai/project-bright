interface Props {
  amount: number | undefined;
  label?: string;
  size?: 'sm' | 'md';
}

export function CostBadge({ amount, label, size = 'sm' }: Props) {
  if (amount === undefined) return null;
  const fmt = amount === 0 ? 'Free' : `$${amount.toFixed(3)}`;
  return (
    <span className={`inline-block rounded font-mono ${
      size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
    } bg-gray-800 text-gray-400`}>
      {label ? `${label}: ` : ''}{fmt}
    </span>
  );
}
