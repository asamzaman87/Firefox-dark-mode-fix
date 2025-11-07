const GradientLoader = () => {
    return (
        <div className="gpt:relative gpt:w-[90%] gpt:blur-[1px] gpt:h-1 gpt:overflow-hidden">
            <div className="gpt:relative gpt:bg-gradient-to-r gpt:top-0 gpt:left-0 gpt:dark:from-gray-900 gpt:from-gray-100 gpt:via-transparent gpt:dark:via-transparent gpt:dark:to-gray-900 gpt:to-gray-100 gpt:flex gpt:size-full gpt:overflow-hidden gpt:flex-row gpt:items-center gpt:justify-center gpt:z-20"></div>
            <div className="gpt:absolute gpt:top-0 gpt:left-0 gpt:size-full gpt:animate-border gpt:inline-block gpt:rounded-md gpt:bg-white gpt:bg-gradient-to-r gpt:from-red-500 gpt:via-purple-500 gpt:to-blue-500 bg-[length:gpt:400%_400%] gpt:z-10"></div>
        </div>
    );
};

export default GradientLoader;