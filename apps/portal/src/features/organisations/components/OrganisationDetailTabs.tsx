"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
  Checkbox,
} from "@timber/ui";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Settings2,
  Handshake,
  Database,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
} from "lucide-react";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import type { Organisation, DeliveryAddress } from "../types";
import { OrganisationUsersTable } from "./OrganisationUsersTable";
import { OrganisationModulesTab } from "./OrganisationModulesTab";
import { TradingPartnersTab } from "./TradingPartnersTab";
import { ReferenceDataManager } from "@/features/reference-data";
import {
  toggleOrganisationExternal,
  updateOrganisation,
  getDeliveryAddresses,
  saveDeliveryAddress,
  deleteDeliveryAddress,
  uploadOrgLogo,
} from "../actions";

interface OrganisationDetailTabsProps {
  organisation: Organisation;
  defaultTab?: string;
}

/**
 * Organisation Detail Tabs
 *
 * Displays organisation details in a tabbed interface.
 */
export function OrganisationDetailTabs({
  organisation,
  defaultTab,
}: OrganisationDetailTabsProps) {
  const [isExternal, setIsExternal] = useState(organisation.isExternal);
  const [isTogglingExternal, setIsTogglingExternal] = useState(false);

  // Editable fields (name/code inline editing)
  const [name, setName] = useState(organisation.name);
  const [code, setCode] = useState(organisation.code);
  const [editingField, setEditingField] = useState<"name" | "code" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Organisation details form
  const [legalAddress, setLegalAddress] = useState(organisation.legalAddress ?? "");
  const [vatNumber, setVatNumber] = useState(organisation.vatNumber ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(organisation.registrationNumber ?? "");
  const [country, setCountry] = useState(organisation.country ?? "");
  const [phone, setPhone] = useState(organisation.phone ?? "");
  const [email, setEmail] = useState(organisation.email ?? "");
  const [website, setWebsite] = useState(organisation.website ?? "");
  const [bankName, setBankName] = useState(organisation.bankName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(organisation.bankAccountNumber ?? "");
  const [bankSwiftCode, setBankSwiftCode] = useState(organisation.bankSwiftCode ?? "");
  const [logoUrl, setLogoUrl] = useState(organisation.logoUrl ?? "");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [savedDetails, setSavedDetails] = useState({
    legalAddress: organisation.legalAddress ?? "",
    vatNumber: organisation.vatNumber ?? "",
    registrationNumber: organisation.registrationNumber ?? "",
    country: organisation.country ?? "",
    phone: organisation.phone ?? "",
    email: organisation.email ?? "",
    website: organisation.website ?? "",
    bankName: organisation.bankName ?? "",
    bankAccountNumber: organisation.bankAccountNumber ?? "",
    bankSwiftCode: organisation.bankSwiftCode ?? "",
  });

  // Delivery addresses
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [editingAddress, setEditingAddress] = useState<Partial<DeliveryAddress> | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const loadAddresses = useCallback(async () => {
    const result = await getDeliveryAddresses(organisation.id);
    if (result.success) {
      setAddresses(result.data);
    }
    setIsLoadingAddresses(false);
  }, [organisation.id]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // --- Name/Code inline editing ---
  const handleExternalToggle = async () => {
    setIsTogglingExternal(true);
    const newValue = !isExternal;
    const result = await toggleOrganisationExternal(organisation.id, newValue);
    if (result.success) {
      setIsExternal(result.data.isExternal);
      toast.success(newValue ? "Marked as external" : "Marked as internal");
    } else {
      toast.error(result.error);
    }
    setIsTogglingExternal(false);
  };

  const startEditing = (field: "name" | "code") => {
    setEditingField(field);
    setEditValue(field === "name" ? name : code);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveField = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error(`${editingField === "name" ? "Name" : "Code"} cannot be empty`);
      return;
    }

    if (
      (editingField === "name" && trimmed === name) ||
      (editingField === "code" && trimmed.toUpperCase() === code)
    ) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    const input =
      editingField === "name"
        ? { name: trimmed }
        : { name, code: trimmed };

    const result = await updateOrganisation(organisation.id, input);
    if (result.success) {
      if (editingField === "name") {
        setName(result.data.name);
      } else {
        setCode(result.data.code);
      }
      toast.success(`${editingField === "name" ? "Name" : "Code"} updated`);
      cancelEditing();
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveField();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  // --- Organisation details save ---
  const hasDetailsChanged =
    legalAddress !== savedDetails.legalAddress ||
    vatNumber !== savedDetails.vatNumber ||
    registrationNumber !== savedDetails.registrationNumber ||
    country !== savedDetails.country ||
    phone !== savedDetails.phone ||
    email !== savedDetails.email ||
    website !== savedDetails.website ||
    bankName !== savedDetails.bankName ||
    bankAccountNumber !== savedDetails.bankAccountNumber ||
    bankSwiftCode !== savedDetails.bankSwiftCode;

  const saveDetails = async () => {
    setIsSavingDetails(true);
    const result = await updateOrganisation(organisation.id, {
      name,
      legalAddress: legalAddress || null,
      vatNumber: vatNumber || null,
      registrationNumber: registrationNumber || null,
      country: country || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      bankName: bankName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankSwiftCode: bankSwiftCode || null,
    });
    if (result.success) {
      setSavedDetails({ legalAddress, vatNumber, registrationNumber, country, phone, email, website, bankName, bankAccountNumber, bankSwiftCode });
      toast.success("Organisation details saved");
    } else {
      toast.error(result.error);
    }
    setIsSavingDetails(false);
  };

  // --- Logo upload ---
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadOrgLogo(organisation.id, formData);
    if (result.success) {
      setLogoUrl(result.data.logoUrl);
      toast.success("Logo uploaded");
    } else {
      toast.error(result.error);
    }
    setIsUploadingLogo(false);

    // Reset input so same file can be re-selected
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // --- Delivery addresses ---
  const startNewAddress = () => {
    setEditingAddress({
      label: "",
      address: "",
      contactName: "",
      contactPhone: "",
      contactHours: "Mo-Fr 8:00-16:00",
      isDefault: false,
    });
  };

  const startEditAddress = (addr: DeliveryAddress) => {
    setEditingAddress({ ...addr });
  };

  const cancelAddressEdit = () => {
    setEditingAddress(null);
  };

  const handleSaveAddress = async () => {
    if (!editingAddress) return;
    if (!editingAddress.label?.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!editingAddress.address?.trim()) {
      toast.error("Address is required");
      return;
    }

    setIsSavingAddress(true);
    const result = await saveDeliveryAddress(organisation.id, {
      id: editingAddress.id,
      label: editingAddress.label!,
      address: editingAddress.address!,
      contactName: editingAddress.contactName || null,
      contactPhone: editingAddress.contactPhone || null,
      contactHours: editingAddress.contactHours || null,
      isDefault: editingAddress.isDefault ?? false,
    });

    if (result.success) {
      toast.success(editingAddress.id ? "Address updated" : "Address added");
      setEditingAddress(null);
      await loadAddresses();
    } else {
      toast.error(result.error);
    }
    setIsSavingAddress(false);
  };

  const handleDeleteAddress = async (addressId: string) => {
    const result = await deleteDeliveryAddress(organisation.id, addressId);
    if (result.success) {
      toast.success("Address deleted");
      await loadAddresses();
    } else {
      toast.error(result.error);
    }
  };

  const urlDefault =
    defaultTab === "users" || defaultTab === "features" || defaultTab === "reference" || defaultTab === "partners"
      ? defaultTab
      : undefined;

  const [activeTab, setActiveTab] = usePersistedTab(
    "organisation-detail-tab",
    "details",
    urlDefault
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="details">
          <Building2 className="h-4 w-4" />
          Details
        </TabsTrigger>
        <TabsTrigger value="users">
          <Users className="h-4 w-4" />
          Users ({organisation.userCount ?? 0})
        </TabsTrigger>
        <TabsTrigger value="features">
          <Settings2 className="h-4 w-4" />
          Modules
        </TabsTrigger>
        <TabsTrigger value="reference">
          <Database className="h-4 w-4" />
          Reference Data
        </TabsTrigger>
        <TabsTrigger value="partners">
          <Handshake className="h-4 w-4" />
          Trading Partners
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <div className="space-y-6">
          {/* Existing: Name, Code, Status, Type */}
          <Card>
            <CardHeader>
              <CardTitle>Organisation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Code
                  </label>
                  {editingField === "code" ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="h-8 w-24 font-mono uppercase"
                        maxLength={3}
                        autoFocus
                        disabled={isSaving}
                      />
                      <Button variant="ghost" size="icon-sm" onClick={saveField} disabled={isSaving}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={cancelEditing} disabled={isSaving}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-lg font-semibold">{code}</p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing("code")}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-1">
                    <Badge
                      variant={organisation.isActive ? "success" : "secondary"}
                    >
                      {organisation.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Type
                  </label>
                  <div className="mt-1 flex items-center gap-1">
                    <Button
                      variant={!isExternal ? "default" : "outline"}
                      size="sm"
                      onClick={() => !isExternal ? null : handleExternalToggle()}
                      disabled={isTogglingExternal}
                      className="rounded-r-none"
                    >
                      Internal
                    </Button>
                    <Button
                      variant={isExternal ? "default" : "outline"}
                      size="sm"
                      onClick={() => isExternal ? null : handleExternalToggle()}
                      disabled={isTogglingExternal}
                      className="rounded-l-none"
                    >
                      External
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                {editingField === "name" ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      className="h-8 max-w-md"
                      maxLength={100}
                      autoFocus
                      disabled={isSaving}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={saveField} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={cancelEditing} disabled={isSaving}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-lg">{name}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing("name")}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created
                  </label>
                  <p className="text-sm">
                    {new Date(organisation.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </label>
                  <p className="text-sm">
                    {new Date(organisation.updatedAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organisation Details: Legal, VAT, Registration, Country */}
          <Card>
            <CardHeader>
              <CardTitle>Legal &amp; Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legalAddress">Legal Address</Label>
                  <Textarea
                    id="legalAddress"
                    value={legalAddress}
                    onChange={(e) => setLegalAddress(e.target.value)}
                    placeholder="Full legal address"
                    rows={3}
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="e.g. EE123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number</Label>
                    <Input
                      id="registrationNumber"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. 12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Estonia"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +44 20 1234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. info@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g. https://company.com"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveDetails}
                  disabled={isSavingDetails || !hasDetailsChanged}
                >
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Barclays"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankSwiftCode">SWIFT Code</Label>
                  <Input
                    id="bankSwiftCode"
                    value={bankSwiftCode}
                    onChange={(e) => setBankSwiftCode(e.target.value)}
                    placeholder="e.g. NWBKGB2L"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveDetails}
                  disabled={isSavingDetails || !hasDetailsChanged}
                >
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`${name} logo`}
                      className="h-full w-full rounded-lg object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {logoUrl ? "Logo is set" : "No logo uploaded yet"}
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {isUploadingLogo ? "Uploading..." : logoUrl ? "Replace Logo" : "Upload Logo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Addresses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Delivery Addresses</CardTitle>
              {addresses.length < 2 && !editingAddress && (
                <Button variant="outline" size="sm" onClick={startNewAddress}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Address
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAddresses ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <>
                  {/* Existing addresses */}
                  {addresses.map((addr) =>
                    editingAddress?.id === addr.id ? (
                      <DeliveryAddressForm
                        key={addr.id}
                        address={editingAddress}
                        onChange={setEditingAddress}
                        onSave={handleSaveAddress}
                        onCancel={cancelAddressEdit}
                        isSaving={isSavingAddress}
                        legalAddress={legalAddress}
                      />
                    ) : (
                      <div
                        key={addr.id}
                        className="rounded-lg border p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{addr.label}</p>
                            {addr.isDefault && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEditAddress(addr)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteAddress(addr.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-line">{addr.address}</p>
                        {(addr.contactName || addr.contactPhone || addr.contactHours) && (
                          <div className="text-sm text-muted-foreground space-y-0.5 pt-1 border-t">
                            {addr.contactName && <p>Contact: {addr.contactName}</p>}
                            {addr.contactPhone && <p>Phone: {addr.contactPhone}</p>}
                            {addr.contactHours && <p>Hours: {addr.contactHours}</p>}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* New address form */}
                  {editingAddress && !editingAddress.id && (
                    <DeliveryAddressForm
                      address={editingAddress}
                      onChange={setEditingAddress}
                      onSave={handleSaveAddress}
                      onCancel={cancelAddressEdit}
                      isSaving={isSavingAddress}
                      legalAddress={legalAddress}
                    />
                  )}

                  {addresses.length === 0 && !editingAddress && (
                    <p className="text-sm text-muted-foreground">
                      No delivery addresses added yet.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="users">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganisationUsersTable organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="features">
        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganisationModulesTab organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reference">
        <Card>
          <CardHeader>
            <CardTitle>Reference Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferenceDataManager canDelete organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="partners">
        <Card>
          <CardHeader>
            <CardTitle>Trading Partners</CardTitle>
          </CardHeader>
          <CardContent>
            <TradingPartnersTab organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// --- Delivery Address Form Component ---

function DeliveryAddressForm({
  address,
  onChange,
  onSave,
  onCancel,
  isSaving,
  legalAddress,
}: {
  address: Partial<DeliveryAddress>;
  onChange: (addr: Partial<DeliveryAddress>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  legalAddress?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-label">Label *</Label>
          <Input
            id="addr-label"
            value={address.label ?? ""}
            onChange={(e) => onChange({ ...address, label: e.target.value })}
            placeholder="e.g. Main warehouse"
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-contact-name">Contact Name</Label>
          <Input
            id="addr-contact-name"
            value={address.contactName ?? ""}
            onChange={(e) => onChange({ ...address, contactName: e.target.value })}
            placeholder="Contact person"
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="addr-address">Address *</Label>
          {legalAddress && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-muted-foreground"
              onClick={() => onChange({ ...address, address: legalAddress })}
              disabled={isSaving}
            >
              Same as legal address
            </Button>
          )}
        </div>
        <Textarea
          id="addr-address"
          value={address.address ?? ""}
          onChange={(e) => onChange({ ...address, address: e.target.value })}
          placeholder="Full delivery address"
          rows={2}
          disabled={isSaving}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="addr-phone">Contact Phone</Label>
          <Input
            id="addr-phone"
            value={address.contactPhone ?? ""}
            onChange={(e) => onChange({ ...address, contactPhone: e.target.value })}
            placeholder="+44 ..."
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr-hours">Contact Hours</Label>
          <Input
            id="addr-hours"
            value={address.contactHours ?? ""}
            onChange={(e) => onChange({ ...address, contactHours: e.target.value })}
            placeholder="e.g. Mo-Fr 8.00-16.00"
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="addr-default"
          checked={address.isDefault ?? false}
          onCheckedChange={(checked) =>
            onChange({ ...address, isDefault: checked === true })
          }
          disabled={isSaving}
        />
        <Label htmlFor="addr-default" className="text-sm font-normal">
          Default delivery address
        </Label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={onSave} disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : address.id ? "Update Address" : "Add Address"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
