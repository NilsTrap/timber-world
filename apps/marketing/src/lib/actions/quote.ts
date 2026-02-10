"use server";

import { Resend } from "resend";
import { createClient } from "@timber/database/server";

interface QuoteFormData {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  product?: string;
  species?: string;
  type?: string;
  quality?: string;
  humidity?: string;
  thickness?: string;
  width?: string;
  length?: string;
  pieces?: string;
  notes?: string;
  selectedProductIds?: string[];
}

type ActionResult = { success: true } | { success: false; error: string };

export async function submitQuoteRequest(formData: FormData): Promise<ActionResult> {
  try {
    // Parse selected product IDs if present
    const selectedProductIdsRaw = formData.get("selectedProductIds") as string;
    const selectedProductIds = selectedProductIdsRaw
      ? selectedProductIdsRaw.split(",").filter(Boolean)
      : undefined;

    const data: QuoteFormData = {
      name: formData.get("name") as string,
      company: formData.get("company") as string || undefined,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || undefined,
      product: formData.get("product") as string || undefined,
      species: formData.get("species") as string || undefined,
      type: formData.get("type") as string || undefined,
      quality: formData.get("quality") as string || undefined,
      humidity: formData.get("humidity") as string || undefined,
      thickness: formData.get("thickness") as string || undefined,
      width: formData.get("width") as string || undefined,
      length: formData.get("length") as string || undefined,
      pieces: formData.get("pieces") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      selectedProductIds,
    };

    // Validate required fields
    if (!data.name || !data.email) {
      return { success: false, error: "Name and email are required" };
    }

    // Save to database first
    const supabase = await createClient();
    const { error: dbError } = await supabase
      .from("quote_requests")
      .insert({
        name: data.name,
        company: data.company || null,
        email: data.email,
        phone: data.phone || null,
        product: data.product || null,
        species: data.species || null,
        type: data.type || null,
        quality: data.quality || null,
        humidity: data.humidity || null,
        thickness: data.thickness || null,
        width: data.width || null,
        length: data.length || null,
        pieces: data.pieces || null,
        notes: data.notes || null,
        selected_product_ids: data.selectedProductIds || null,
        status: "new",
      });

    if (dbError) {
      console.error("Failed to save quote request to database:", dbError);
      // Continue to try sending email even if DB fails
    }

    // Try to send email notification
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured - quote saved to database only");
      return { success: true };
    }

    const resend = new Resend(resendApiKey);

    // Format the email content
    const emailHtml = `
      <h2>New Quote Request</h2>

      <h3>Contact Information</h3>
      <p><strong>Name:</strong> ${data.name}</p>
      ${data.company ? `<p><strong>Company:</strong> ${data.company}</p>` : ""}
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ""}

      <h3>Product Specifications</h3>
      ${data.product ? `<p><strong>Product:</strong> ${data.product}</p>` : ""}
      ${data.species ? `<p><strong>Species:</strong> ${data.species}</p>` : ""}
      ${data.type ? `<p><strong>Type:</strong> ${data.type}</p>` : ""}
      ${data.quality ? `<p><strong>Quality:</strong> ${data.quality}</p>` : ""}
      ${data.humidity ? `<p><strong>Humidity:</strong> ${data.humidity}</p>` : ""}
      ${data.thickness ? `<p><strong>Thickness:</strong> ${data.thickness} mm</p>` : ""}
      ${data.width ? `<p><strong>Width:</strong> ${data.width} mm</p>` : ""}
      ${data.length ? `<p><strong>Length:</strong> ${data.length} mm</p>` : ""}
      ${data.pieces ? `<p><strong>Pieces:</strong> ${data.pieces}</p>` : ""}

      ${data.notes ? `<h3>Additional Notes</h3><p>${data.notes.replace(/\n/g, "<br>")}</p>` : ""}
    `;

    const emailText = `
New Quote Request

Contact Information
-------------------
Name: ${data.name}
${data.company ? `Company: ${data.company}` : ""}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ""}

Product Specifications
----------------------
${data.product ? `Product: ${data.product}` : ""}
${data.species ? `Species: ${data.species}` : ""}
${data.type ? `Type: ${data.type}` : ""}
${data.quality ? `Quality: ${data.quality}` : ""}
${data.humidity ? `Humidity: ${data.humidity}` : ""}
${data.thickness ? `Thickness: ${data.thickness} mm` : ""}
${data.width ? `Width: ${data.width} mm` : ""}
${data.length ? `Length: ${data.length} mm` : ""}
${data.pieces ? `Pieces: ${data.pieces}` : ""}

${data.notes ? `Additional Notes\n----------------\n${data.notes}` : ""}
    `.trim();

    await resend.emails.send({
      from: "Timber International <noreply@timber-international.com>",
      to: "info@timber-international.com",
      replyTo: data.email,
      subject: `Quote Request from ${data.name}${data.company ? ` (${data.company})` : ""}`,
      html: emailHtml,
      text: emailText,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to submit quote request:", error);
    return { success: false, error: "Failed to submit quote request. Please try again." };
  }
}
