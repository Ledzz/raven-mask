import { FC, useCallback, useMemo, useState } from "react";
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
  const allChecked = mask === 511;
  const toggleAll = useCallback(() => {
    if (allChecked) {
      setMask(0);
    } else {
      setMask(511);
    }
  }, [allChecked]);

  return (
    <>
      <div className="zones">
        <label>
          <input type={"checkbox"} checked={allChecked} onChange={toggleAll} />
          Все
        </label>
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
