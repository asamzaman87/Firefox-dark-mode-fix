import { FC, memo, useEffect, useRef } from "react";

interface AnnouncementMessageProps {
  message: string;
}
const AnnouncementMessage: FC<AnnouncementMessageProps> = ({ message }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = message;
    }
  }, [message]);

  return <div ref={ref} />;
};

export default memo(AnnouncementMessage);