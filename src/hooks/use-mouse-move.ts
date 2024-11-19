import { useEffect, useState } from "react";

const useMouseMove = () => {
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [hide, setHide] = useState<boolean>(true);

    const handleMouseMove = () => {
        setHide(false);
        if (intervalId) {
            clearInterval(intervalId);
        }
        setIntervalId(setInterval(()=>setHide(true), 5000));
    };

    useEffect(() => {
        handleMouseMove()
        return () => { 
            intervalId && clearInterval(intervalId); 
        }
    }, []);

    return { hide, handleMouseMove };
}

export default useMouseMove;