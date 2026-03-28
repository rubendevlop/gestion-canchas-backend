import brandLogo from '../IMG/logo-brand.png';

export default function BrandLogo({
  className = '',
  imageClassName = 'h-12 w-auto',
}) {
  return (
    <img
      src={brandLogo}
      alt="Clubes Tucuman"
      className={`block max-w-full shrink-0 object-contain ${className} ${imageClassName}`.trim()}
    />
  );
}
