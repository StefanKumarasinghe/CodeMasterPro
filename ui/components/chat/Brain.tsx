import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { BrainIcon } from 'lucide-react';

const AURORA_COLORS = [
    'rgba(0, 191, 255, 0.6)',
    'rgba(138, 43, 226, 0.5)',
    'rgba(0, 255, 127, 0.5)',
    'rgba(255, 105, 180, 0.5)',
    'rgba(0, 191, 255, 0.6)',
    'rgba(138, 43, 226, 0.5)',
    'rgba(166, 255, 0, 0.99)',
    'rgba(164, 19, 213, 0.5)',
    'rgba(75, 75, 75, 0.6)',
    'rgba(0, 191, 255, 0.6)',
];
const AURORA_SPREAD = [
    '0 0 40px',
    '0 0 30px',
    '0 0 30px',
    '0 0 25px',
    '0 0 20px'
];
const AURORA_DURATION = 20;
const AURORA_TIMES = [0, 0.25, 0.5, 0.75, 1];
const BinaryCodeBrainEffect: React.FC = () => {

    const containerRef = useRef<HTMLDivElement>(null);


    const animatedBoxShadows = AURORA_COLORS.map((color) => {
        return AURORA_SPREAD.map(spread => `${spread} ${color}`).join(', ');
    });

    return (
        <div ref={containerRef} className="relative mb-5 pb-3 flex items-center justify-center ">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                    scale: 1,
                    opacity: 1,
                    boxShadow: animatedBoxShadows
                }}
                transition={{
                    scale: { duration: 0.8 },
                    opacity: { duration: 0.8 },
                    boxShadow: {
                        duration: AURORA_DURATION,
                        repeat: Infinity,
                        ease: "linear",
                        times: AURORA_TIMES,
                    }
                }}
                className="rounded-full flex items-center justify-center z-10 p-4 bg-white/10 backdrop-blur-sm"
            >
                <BrainIcon className="h-20 w-20 text-black font-light dark:text-white" />
            </motion.div>

        </div>
    );
};

export default BinaryCodeBrainEffect;