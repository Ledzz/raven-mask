import { HexColorPicker } from "react-colorful";
import { FC, useState } from "react";
import { ZONES } from "./zones.ts";

export const Zoned: FC<{
  setMaskedColor: (mask: number, color: string) => void;
}> = ({ setMaskedColor }) => {
  const [mask, setMask] = useState(0);

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
      <HexColorPicker onChange={(e) => setMaskedColor(mask, e)} />
    </>
  );
};
