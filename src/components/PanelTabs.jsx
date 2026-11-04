/** "Configure | Banners" switch at the top of the panel. */
export default function PanelTabs({ tab, onChange }) {
  const tabs = [
    ['configure', 'Configure'],
    ['banners', 'Banners'],
  ]
  return (
    <div className="panel-tabs" role="tablist" aria-label="Panel">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className="panel-tab"
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
