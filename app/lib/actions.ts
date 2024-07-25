'use server';
import {date, z} from 'zod'
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from 'auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState : string | undefined,
    formDate : FormData,
){
    try{
        await signIn('credentials',formDate);
    } catch(error){
        if(error instanceof AuthError){
            switch (error.type){
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong';
            }
        }
        throw error;
    }
}

const FormSchema = z.object({
    id:z.string(),
    customerId:z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount:z.coerce
            .number()
            .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status:z.enum(['pending','paid'],{
        invalid_type_error: 'Please select an invoice status.',
    }),
    date:z.string()
})

export type State = {
    errors?:{
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};


//Create invoice 
const CreateInoice = FormSchema.omit({id:true,date:true});

export async function CreateInvoice(prevState : State, formData : FormData){
    const validatedFields = CreateInoice.safeParse({
        customerId : formData.get('customerId'),
        amount : formData.get('amount'),
        status : formData.get('status'),
    });
    if(!validatedFields.success){
        return {
            errors:validatedFields.error.flatten().fieldErrors,
            message : 'Missing Fields. Failed to Create Invoice.',
        }
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountIncents = amount*100;
    const date= new Date().toISOString().split('T')[0];
    try{    
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountIncents}, ${status}, ${date} )
        `;
    }
    catch(error){
        return{
            message: 'Database error : Failed to create invoice',
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

//Update invoice 
const UpdateInvoice = FormSchema.omit({id:true, date:true});

export async function updateInvoice(
    id: string,
    prevState : State,
    formData: FormData
){
    debugger

    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    if(!validatedFields.success){
        return{
            errors : validatedFields.error.flatten().fieldErrors,
            message : 'Missing Fields. Failed to Update Invoice.',
        }
    }

    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = amount * 100;

    try{    
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    }
    catch(error){
        return{
            message: 'Database error : Failed to update invoice',
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

//Delete invoice
export async function deleteInvoice(id: string) {

    try{
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
    }
    catch(error) {
        return {
          message: 'Database Error: Failed to delete Invoice.',
        };
    }
}

