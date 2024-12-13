import { HexColorPicker } from "react-colorful";
import { FC } from "react";

type Value = {
  color: string;
  brightness: number;
  mode: string;
};
export const Picker: FC<{
  value: Value;
  onChange: (value: Value) => void;
}> = ({ value, onChange }) => {
  return (
    <>
      <HexColorPicker
        color={value.color}
        onChange={(e) =>
          onChange({
            ...value,
            color: e,
          })
        }
      />
      <input
        type="range"
        min={0}
        max={255}
        step={1}
        value={value.brightness}
        onChange={(e) => {
          onChange({
            ...value,
            brightness: parseInt(e.target.value),
          });
        }}
      />
    </>
  );
};
