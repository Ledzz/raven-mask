import { HexColorPicker } from "react-colorful";
import { FC, useState } from "react";
import { ZONES } from "./zones.ts";

export const Zoned: FC<{
  setMaskedColor: (
    mask: number,
    color: string,
    brightness: number,
    mode: string,
  ) => void;
}> = ({ currentConfig, setMaskedColor }) => {
  const [mask, setMask] = useState(0);
  const [color, setColor] = useState("#ff0000");

  const [brightness, setBrightness] = useState(20);

  return (
    <>
      <div className="zones">
        {ZONES.map((zone) => (
          <label>
            <input
              type={"checkbox"}
              checked={!!(mask & (1 << zone.id))}
              onChange={() => setMask(mask ^ (1 << zone.id))}
            />
            {zone.name}
          </label>
        ))}
      </div>
      <HexColorPicker
        onChange={(e) => {
          setColor(e);
          setMaskedColor(mask, e, brightness, "SIMPLE");
        }}
      />
      <input
        type="range"
        min={0}
        max={255}
        step={1}
        value={brightness}
        onChange={(e) => {
          setBrightness(e.target.value);
          setMaskedColor(mask, color, e.target.value, "SIMPLE");
        }}
      />
    </>
  );
};
