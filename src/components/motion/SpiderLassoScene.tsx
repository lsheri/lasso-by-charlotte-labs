import { motion } from "motion/react";

import cardsOutline from "@/assets/m6/cards-outline.svg";
import cardsStack from "@/assets/m6/cards-stack.svg";
import v1119 from "@/assets/m6/v-1119.svg";
import v1120 from "@/assets/m6/v-1120.svg";
import v1121 from "@/assets/m6/v-1121.svg";
import v1122 from "@/assets/m6/v-1122.svg";
import v1124 from "@/assets/m6/v-1124.svg";
import v1125 from "@/assets/m6/v-1125.svg";
import v1126 from "@/assets/m6/v-1126.svg";
import v1127 from "@/assets/m6/v-1127.svg";
import v1128 from "@/assets/m6/v-1128.svg";
import v1129 from "@/assets/m6/v-1129.svg";
import v1130 from "@/assets/m6/v-1130.svg";
import v1131 from "@/assets/m6/v-1131.svg";
import v1132 from "@/assets/m6/v-1132.svg";
import v1133 from "@/assets/m6/v-1133.svg";
import v1134 from "@/assets/m6/v-1134.svg";
import v1135 from "@/assets/m6/v-1135.svg";
import { useReducedMotion } from "@/hooks/use-motion";

const LOOP_DURATION = 4.2;
const LOOP_REPEAT = Infinity;

const image = (src: string, alt = "") => (
  <img src={src} alt={alt} className="block size-full max-w-none" draggable={false} />
);

export function SpiderLassoScene() {
  const reducedMotion = useReducedMotion();

  return (
    <figure className="relative h-[482px] w-[560px]" aria-hidden="true">
      <div className="absolute h-[440px] w-[560px] overflow-clip">
        <div className="absolute inset-[33.39%_42.29%_15.21%_9.85%]">
          <div className="absolute inset-[-0.37%_-0.22%_-0.26%_0]">
            {image(cardsStack)}
          </div>
        </div>

        <div
          className="absolute inset-[61.57%_78.29%_33.79%_calc(14%+0.26%)] flex items-center justify-center"
          style={{ containerType: "size" }}
        >
          <div className="-rotate-8 h-[hypot(5.00643cqw,72.7391cqh)] w-[hypot(94.9936cqw,-27.2609cqh)] flex-none">
            <p className="whitespace-nowrap font-mono text-[11px] text-[var(--nb-graphite)]">
              CLAUDE
            </p>
          </div>
        </div>
        <div
          className="absolute inset-[69.94%_51.69%_25.73%_39.72%] flex items-center justify-center"
          style={{ containerType: "size" }}
        >
          <div className="h-[hypot(-2.71635cqw,78.4849cqh)] w-[hypot(97.2837cqw,21.5151cqh)] flex-none rotate-5">
            <p className="whitespace-nowrap font-mono text-[11px] text-[var(--nb-graphite)]">
              CHATGPT
            </p>
          </div>
        </div>
        <div
          className="absolute inset-[38.76%_66.28%_57.27%_25.2%] flex items-center justify-center"
          style={{ containerType: "size" }}
        >
          <div className="-rotate-3 h-[hypot(1.64507cqw,85.8951cqh)] w-[hypot(98.3549cqw,-14.1049cqh)] flex-none">
            <p className="whitespace-nowrap font-mono text-[11px] text-[var(--nb-graphite)]">
              GRANOLA
            </p>
          </div>
        </div>

        <div className="absolute inset-[44.07%_46.56%_22.85%_14.68%]">
          <div className="absolute inset-[-0.69%_-0.46%_-0.69%_0]">
            {image(cardsOutline)}
          </div>
        </div>
        <div className="absolute inset-[26.68%_35.81%_12.22%_6.7%]">
          <div className="absolute inset-[-0.65%_-0.54%]">
            <svg
              className="block size-full max-w-none"
              preserveAspectRatio="none"
              viewBox="0 0 325.47 272.315"
              fill="none"
            >
              <motion.path
                d="M4.77186 26.4545C-17.2281 144.454 82.7719 284.454 242.772 269.454C342.772 259.454 342.772 144.454 282.772 74.4545C234.772 16.4545 58.7719 -23.5455 8.77186 20.4545"
                pathLength={1}
                stroke="var(--nb-green)"
                strokeWidth="3.5"
                strokeLinecap="round"
                initial={reducedMotion ? false : { strokeDasharray: "0 1", strokeDashoffset: 0 }}
                animate={reducedMotion ? { strokeDasharray: "1 1" } : { strokeDasharray: ["0 1", "0 1", "1 1", "1 1"] }}
                {...(reducedMotion ? {} : { transition: { duration: LOOP_DURATION, ease: [[0.5, 0, 0.5, 1], "easeInOut", "linear"], times: [0, 0.262, 0.548, 1], repeat: LOOP_REPEAT } })}
              />
            </svg>
          </div>
        </div>
        <motion.div
          className="absolute inset-[35.93%_23.21%_56.82%_57.14%]"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 0, 1, 1] }}
          {...(reducedMotion ? {} : { transition: { opacity: { duration: LOOP_DURATION, times: [0, 0.5238, 0.5952, 1], ease: ["linear", "easeOut", "linear"], repeat: LOOP_REPEAT } } })}
        >
          <div className="absolute inset-[-5.5%_-1.59%_-5.49%_-1.59%]">{image(v1119)}</div>
        </motion.div>
        <div className="absolute inset-[25.45%_7.86%_57.27%_75.71%]">
          <div className="absolute inset-[-1.97%_-1.63%]">{image(v1120)}</div>
        </div>
        <div className="absolute inset-[20.91%_16.79%_67.27%_73.93%]">
          <div className="absolute inset-[-2.88%]">{image(v1121)}</div>
        </div>
        <div className="absolute bottom-[73.18%] left-[76.43%] right-[22.14%] top-1/4">
          <div className="absolute inset-0">{image(v1122)}</div>
        </div>
        <div className="absolute inset-[24.55%_19.46%_73.64%_79.11%]">
          <div className="absolute inset-0">{image(v1122)}</div>
        </div>
        <div className="absolute inset-[29.09%_19.64%_70%_76.79%]">
          <div className="absolute inset-[-31.25%_-6.25%]">{image(v1124)}</div>
        </div>
        <motion.div
          className="absolute inset-[37.5%_23.21%_43.18%_66.43%]"
          initial={reducedMotion ? false : { rotate: 0 }}
          animate={reducedMotion ? { rotate: 0 } : { rotate: [0, 0, -6, 0, 0, 5, 0, 0] }}
          {...(reducedMotion ? {} : { transition: { rotate: { duration: LOOP_DURATION, times: [0, 0.2381, 0.3095, 0.381, 0.5714, 0.6429, 0.7143, 1], ease: ["linear", "easeInOut", "easeInOut", "linear", "easeInOut", "easeInOut", "linear"], repeat: LOOP_REPEAT } } })}
        >
          <div className="absolute inset-[-1.76%_-2.59%_-1.77%_-2.59%]">{image(v1125)}</div>
        </motion.div>
        <div className="absolute inset-[40.91%_20.54%_37.5%_74.94%]">
          <div className="absolute inset-[-1.58%_-5.92%]">{image(v1126)}</div>
        </div>
        <div className="absolute inset-[39.77%_5.67%_38.64%_89.29%]">
          <div className="absolute inset-[-1.58%_-5.31%]">{image(v1127)}</div>
        </div>
        <div className="absolute inset-[36.36%_0.6%_44.32%_91.43%]">
          <div className="absolute inset-[-1.76%_-3.36%]">{image(v1128)}</div>
        </div>
        <div className="absolute inset-[29.94%_22.14%_68.18%_calc(64%+0.29%)]">
          <div className="absolute inset-[-18.14%_-1.97%_-18.15%_-1.97%]">{image(v1129)}</div>
        </div>
        <div className="absolute inset-[27.33%_0.71%_70.45%_90.18%]">
          <div className="absolute inset-[-15.38%_-2.94%_-15.39%_-2.94%]">{image(v1130)}</div>
        </div>
        <div className="absolute inset-[42.27%_16.28%_39.09%_83.21%]">
          <div className="absolute inset-[-1.83%_-53.03%_-1.83%_-53.04%]">{image(v1131)}</div>
        </div>
        <div className="absolute inset-[41.82%_11.51%_39.09%_86.79%]">
          <div className="absolute inset-[-1.79%_-15.67%_-1.79%_-15.68%]">{image(v1132)}</div>
        </div>
        <div className="absolute inset-[37.5%_22.73%_61.81%_76.79%]">
          <div className="absolute inset-[-49.25%_-54.72%_-49.26%_-54.82%]">{image(v1133)}</div>
        </div>
        <motion.div
          className="absolute inset-[37.5%_23.21%_43.18%_66.43%]"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 0, 1, 1] }}
          {...(reducedMotion ? {} : { transition: { opacity: { duration: LOOP_DURATION, times: [0, 0.5476, 0.619, 1], ease: ["linear", "easeOut", "linear"], repeat: LOOP_REPEAT } } })}
        >
          <div className="absolute inset-[-2.06%_-3.02%]">{image(v1134)}</div>
        </motion.div>
        <motion.div
          className="absolute inset-[67.33%_8.44%_12.33%_70.94%] flex items-center justify-center"
          style={{ containerType: "size" }}
          initial={reducedMotion ? false : { opacity: 0, y: -40 }}
          animate={reducedMotion ? { opacity: 1, y: 0 } : { opacity: [0, 0, 1, 1], y: [-40, -40, 0, 0] }}
          {...(reducedMotion ? {} : { transition: { opacity: { duration: LOOP_DURATION, times: [0, 0.6667, 0.7143, 1], ease: ["linear", [0.5, 0, 0.5, 1], "linear"], repeat: LOOP_REPEAT }, y: { duration: LOOP_DURATION, times: [0, 0.6667, 0.7619, 1], ease: ["linear", "easeOut", "linear"], repeat: LOOP_REPEAT } } })}
        >
          <div className="h-[hypot(-4.95446cqw,91.424cqh)] w-[hypot(95.0455cqw,8.57596cqh)] flex-none rotate-4">
            <div className="relative size-full">
              <div className="absolute inset-[-1.22%_-0.91%]">{image(v1135)}</div>
            </div>
          </div>
        </motion.div>
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 text-center font-hand text-[26px] text-[var(--nb-graphite)]">
        Pull the conversations that mattered into one record.
      </figcaption>
    </figure>
  );
}