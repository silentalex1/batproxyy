import { useEffect, useRef, useState } from "react";

type Props = {
  night: number;
  onDone: () => void;
};

export function NightBreak({ night, onDone }: Props) {
  const [lit, setLit] = useState(false);
  const [rolled, setRolled] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const a = window.setTimeout(() => setLit(true), 1150);
    const b = window.setTimeout(() => setRolled(true), 2500);
    const c = window.setTimeout(() => done.current(), 4600);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      window.clearTimeout(c);
    };
  }, []);

  return (
    <div className="breaker">
      <div className={`breaker-in ${lit ? "lit" : ""}`}>
        <p className="breaker-line">
          you <span>survived.</span>
        </p>
        <p className="breaker-night">
          <em>night</em>
          <span className="roll">
            <b className={`digit ${rolled ? "gone" : "here"}`}>{night}</b>
            <b className={`digit ${rolled ? "here" : "waiting"}`}>{night + 1}</b>
          </span>
        </p>
      </div>
    </div>
  );
}
