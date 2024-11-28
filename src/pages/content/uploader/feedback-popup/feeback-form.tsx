import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Ratings from "@/components/ui/ratings";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, LoaderIcon } from "lucide-react";
import { FC } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    rating: z.number().min(1, { message: "What would you rate this extension?" }),
    text: z.string().min(5, { message: "Please leave a comment about what you found useful or not useful." })
})

export interface FeedbackFormProps {
    onSubmit: (values: z.infer<typeof formSchema>) => void;
    loading?: boolean;
}

const FeedbackForm: FC<FeedbackFormProps> = ({ onSubmit, loading }) => {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            text: "",
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
                    <h1 className="text-xl">We appreciate your feedback.</h1>
                    <p className="text-gray-500 text-sm">We are always looking for ways to improve our services. Please let us know what we can do better.</p>
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
                    name="text"
                    render={({ field }) => (
                        <FormItem className="w-full">
                            <FormControl>
                                <Textarea className="resize-none rounded-lg min-h-[50dvh] placeholder:text-gray-400 placeholder:text-sm" placeholder="What do you think about this extension?" {...field} />
                            </FormControl>
                            <FormMessage className="text-red-600" />
                        </FormItem>
                    )} />
                <DialogFooter>
                    <Button disabled={loading} type="submit" size={"lg"} variant={"outline"} className="w-full text-lg rounded-lg dark:bg-gray-200 dark:text-gray-900 bg-gray-900 text-gray-100">{loading ? <LoaderIcon className="animate-spin size-4" /> : "Submit My Feedback"}</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default FeedbackForm;