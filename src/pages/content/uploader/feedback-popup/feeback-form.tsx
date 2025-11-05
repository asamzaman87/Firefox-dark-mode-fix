import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Ratings from "@/components/ui/ratings";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, Loader2Icon } from "lucide-react";
import { FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    rating: z.number().min(1, { message: "What would you rate this extension?" }),
    email: z.string().optional(),
    comments: z.string().optional()
})

export interface FeedbackFormProps {
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    loading?: boolean;
}

const FeedbackForm: FC<FeedbackFormProps> = ({ onSubmit, loading }) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            comments: "",
            email: "",
            rating: 0,
        },
    })

    const onFormSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values)
    }

    return (
        <Form {...form}>
            <form className="gpt:w-full gpt:space-y-6 [&_label]:text-lg [&_button]:text-lg" onSubmit={form.handleSubmit(onFormSubmit)}>
                <div className="gpt:w-full gpt:space-y-2">
                    <h1 className="gpt:text-xl">{chrome.i18n.getMessage("we_appreciate_feedback")}</h1>
                    <p className="gpt:text-gray-500 gpt:text-sm">{chrome.i18n.getMessage("feedback_prompt")}</p>
                </div>
                <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                        <FormItem className="gpt:w-full gpt:flex gpt:flex-col gpt:justify-center gpt:items-center">
                            <Ratings size={40} variant="destructive" Icon={<Heart />} asInput value={field.value} onValueChange={field.onChange} />
                            <FormControl className="gpt:sr-only">
                                <Input className="gpt:rounded-lg" {...field} />
                            </FormControl>
                            <FormMessage className="gpt:text-red-600" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="gpt:w-full">
                            <FormControl>
                            <Input className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:rounded gpt:focus:border-gray-200 gpt:dark:focus:border-gray-700 gpt:outline-none gpt:focus-visible:ring-offset-2"  placeholder={"Enter your email"} type="email"  {...field} />     
                            </FormControl>
                            <FormMessage className="gpt:text-red-600" />
                        </FormItem>
                    )} />
                <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                        <FormItem className="gpt:w-full">
                            <FormControl>
                            <Textarea className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:resize-none gpt:rounded gpt:min-h-[50dvh] gpt:focus:border-gray-200 gpt:dark:focus:border-gray-700 gpt:outline-none"  placeholder={chrome.i18n.getMessage("feedback_question")}  {...field} />     
                            </FormControl>
                            <FormMessage className="gpt:text-red-600" />
                        </FormItem>
                    )} />
                <DialogFooter>
                    <Button disabled={loading} type="submit" size={"lg"} variant={"outline"}  className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">{loading ? <Loader2Icon className="gpt:animate-spin gpt:size-4" /> : chrome.i18n.getMessage("submit_feedback")}</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default FeedbackForm;
