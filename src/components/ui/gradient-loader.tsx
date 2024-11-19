const GradientLoader = () => {
    return (
        <div className="relative w-[90%] blur-[1px] h-1 overflow-hidden">
            <div className="relative bg-gradient-to-r top-0 left-0 dark:from-gray-900 from-gray-100 via-transparent dark:via-transparent dark:to-gray-900 to-gray-100 flex size-full overflow-hidden flex-row items-center justify-center z-20"></div>
            <div className="absolute top-0 left-0 size-full animate-border inline-block rounded-md bg-white bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 bg-[length:400%_400%] z-10"></div>
        </div>
    );
};

export default GradientLoader;