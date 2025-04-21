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
            rating: 0,
        },
    })

    const onFormSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values)
    }

    return (
        <Form {...form}>
            <form className="w-full space-y-6 [&_label]:text-lg [&_button]:text-lg" onSubmit={form.handleSubmit(onFormSubmit)}>
                <div className="w-full space-y-2">
                    <h1 className="text-xl">{chrome.i18n.getMessage("we_appreciate_feedback")}</h1>
                    <p className="text-gray-500 text-sm">{chrome.i18n.getMessage("feedback_prompt")}</p>
                </div>
                <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                        <FormItem className="w-full flex flex-col justify-center items-center">
                            <Ratings size={40} variant="destructive" Icon={<Heart />} asInput value={field.value} onValueChange={field.onChange} />
                            <FormControl className="sr-only">
                                <Input className="rounded-lg" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <Textarea className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 resize-none rounded min-h-[50dvh] focus:border-gray-200 dark:focus:border-gray-700 outline-none"  placeholder={chrome.i18n.getMessage("feedback_question")}  {...field} />     
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <DialogFooter>
                    <Button disabled={loading} type="submit" size={"lg"} variant={"outline"}  className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">{loading ? <Loader2Icon className="animate-spin size-4" /> : chrome.i18n.getMessage("submit_feedback")}</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default FeedbackForm;
