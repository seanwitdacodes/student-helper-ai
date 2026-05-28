function BrandMark({ className = "" }) {
  return (
    <div className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <span className="brand-mark-ring" />
      <span className="brand-mark-core" />
      <span className="brand-mark-spark" />
    </div>
  );
}

export default BrandMark;
