import type { SettingsData } from "../types";

type Props = {
  value: SettingsData;
  onChange: (next: SettingsData) => void;
  onClose: () => void;
};

export function Settings({ value, onChange, onClose }: Props) {
  return (
    <div className="veil">
      <article className="slip tall">
        <p className="slip-stamp">AV CLUB</p>
        <h2>Settings</h2>
        <label className="set-row">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value.volume}
            onChange={(e) => onChange({ ...value, volume: Number(e.target.value) })}
          />
        </label>
        <label className="set-row">
          Look sensitivity
          <input
            type="range"
            min={0.06}
            max={0.32}
            step={0.01}
            value={value.pan}
            onChange={(e) => onChange({ ...value, pan: Number(e.target.value) })}
          />
        </label>
        <label className="set-check">
          <input
            type="checkbox"
            checked={value.flicker}
            onChange={(e) => onChange({ ...value, flicker: e.target.checked })}
          />
          Fluorescent flicker
        </label>
        <button type="button" className="paper-btn" onClick={onClose}>
          Close
        </button>
      </article>
    </div>
  );
}
