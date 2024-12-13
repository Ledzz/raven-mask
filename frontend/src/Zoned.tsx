import { FC, useState } from "react";
import { ZONES } from "./zones.ts";
import { Picker } from "./Picker.tsx";
import { MODES } from "./modes.ts";

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
  const [mode, setMode] = useState(MODES[0]);

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
      <Picker
        value={{ color, brightness, mode }}
        onChange={(value) => {
          setColor(value.color);
          setBrightness(value.brightness);
          setMode(value.mode);
          setMaskedColor(mask, value.color, value.brightness, value.mode);
        }}
      />
    </>
  );
};
