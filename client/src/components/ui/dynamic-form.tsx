import { SpinnerInfinity } from "spinners-react";
/**
 * Dynamic Form Component
 *
 * Génère des formulaires depuis un schéma JSON avec validation,
 * sections collapsibles et rendu de champs dynamique.
 */

("use client");

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  usePermissions,
  type Resource,
  type ResourceAction,
} from "@/lib/permissions";

import {
  type FormSchema,
  type FormSection,
  type FieldConfig,
  type DynamicFormProps,
  buildZodSchema,
} from "@/lib/forms/types";
import { renderField } from "@/lib/forms/field-renderers";

// ============================================================================
// Permission Helper
// ============================================================================

function checkPermission(
  requiredPermission: string | undefined,
  can: (
    resource: Resource,
    action: ResourceAction | ResourceAction[],
  ) => boolean,
): boolean {
  if (!requiredPermission) return true;

  const parts = requiredPermission.split(":");
  if (parts.length !== 2) {
    return true;
  }

  const [resource, action] = parts as [Resource, ResourceAction];
  return can(resource, action);
}

// ============================================================================
// Form Section Component
// ============================================================================

interface FormSectionComponentProps {
  section: FormSection;
  values: Record<string, unknown>;
  errors: Record<string, string | undefined>;
  onChange: (fieldId: string, value: unknown) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3 | 4;
  can: (
    resource: Resource,
    action: ResourceAction | ResourceAction[],
  ) => boolean;
}

function FormSectionComponent({
  section,
  values,
  errors,
  onChange,
  disabled,
  columns = 2,
  can,
}: FormSectionComponentProps) {
  const [isOpen, setIsOpen] = React.useState(!section.defaultCollapsed);

  // Filter fields by permission and visibility
  const visibleFields = section.fields.filter((field) => {
    if (!checkPermission(field.requiredPermission, can)) return false;
    if (field.visible && !field.visible(values)) return false;
    return true;
  });

  if (visibleFields.length === 0) return null;

  const content = (
    <div
      className={cn(
        "grid gap-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {visibleFields.map((field) => (
        <div
          key={field.id}
          className={cn(
            field.colSpan && `col-span-${Math.min(field.colSpan, columns)}`,
          )}
          style={{
            gridColumn: field.colSpan
              ? `span ${Math.min(field.colSpan, columns)}`
              : undefined,
          }}
        >
          {renderField({
            field,
            value: values[field.id],
            onChange: (value) => onChange(field.id, value),
            error: errors[field.id],
            disabled,
          })}
        </div>
      ))}
    </div>
  );

  if (!section.collapsible) {
    return (
      <div className="space-y-4">
        {(section.title || section.description) && (
          <div>
            {section.title && (
              <h3 className="text-lg font-medium">{section.title}</h3>
            )}
            {section.description && (
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
            )}
          </div>
        )}
        {content}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div>
              {section.title && (
                <h3 className="text-lg font-medium text-left">
                  {section.title}
                </h3>
              )}
              {section.description && (
                <p className="text-sm text-muted-foreground text-left">
                  {section.description}
                </p>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">{content}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DynamicForm({
  schema,
  defaultValues,
  onSubmit,
  onCancel,
  onChange,
  isLoading,
  readOnly,
  className,
  footer,
  inline,
}: DynamicFormProps) {
  const { can } = usePermissions();

  // Get all fields (from sections or direct fields)
  const allFields = React.useMemo(() => {
    if (schema.sections) {
      return schema.sections.flatMap((s) => s.fields);
    }
    return schema.fields ?? [];
  }, [schema]);

  // Build Zod schema
  const zodSchema = React.useMemo(() => buildZodSchema(allFields), [allFields]);

  // Initialize form
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: defaultValues ?? {},
  });

  // Watch all values
  const values = watch();

  // Handle field change
  const handleFieldChange = React.useCallback(
    (fieldId: string, value: unknown) => {
      setValue(fieldId, value, { shouldValidate: true, shouldDirty: true });
    },
    [setValue],
  );

  // Notify parent of changes
  React.useEffect(() => {
    if (onChange && isDirty) {
      onChange(values);
    }
  }, [values, onChange, isDirty]);

  // Convert react-hook-form errors to simple string map
  const errorMessages = React.useMemo(() => {
    const messages: Record<string, string | undefined> = {};
    for (const [key, error] of Object.entries(errors)) {
      messages[key] = error?.message as string | undefined;
    }
    return messages;
  }, [errors]);

  // Handle form submit
  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  // Filter sections by permission
  const visibleSections = React.useMemo(() => {
    if (!schema.sections) return [];
    return schema.sections.filter((s) =>
      checkPermission(s.requiredPermission, can),
    );
  }, [schema.sections, can]);

  // Filter direct fields by permission and visibility
  const visibleDirectFields = React.useMemo(() => {
    if (!schema.fields) return [];
    return schema.fields.filter((field) => {
      if (!checkPermission(field.requiredPermission, can)) return false;
      if (field.visible && !field.visible(values)) return false;
      return true;
    });
  }, [schema.fields, can, values]);

  return (
    <form onSubmit={onFormSubmit} className={cn("space-y-6", className)}>
      {/* Form header */}
      {(schema.title || schema.description) && (
        <div className="space-y-1">
          {schema.title && (
            <h2 className="text-xl font-semibold">{schema.title}</h2>
          )}
          {schema.description && (
            <p className="text-sm text-muted-foreground">
              {schema.description}
            </p>
          )}
        </div>
      )}

      {/* Sections */}
      {visibleSections.length > 0 && (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <FormSectionComponent
              key={section.id}
              section={section}
              values={values}
              errors={errorMessages}
              onChange={handleFieldChange}
              disabled={isLoading || readOnly}
              columns={schema.columns}
              can={can}
            />
          ))}
        </div>
      )}

      {/* Direct fields (if no sections) */}
      {visibleDirectFields.length > 0 && (
        <div
          className={cn(
            "grid gap-4",
            schema.columns === 1 && "grid-cols-1",
            (!schema.columns || schema.columns === 2) &&
              "grid-cols-1 sm:grid-cols-2",
            schema.columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            schema.columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {visibleDirectFields.map((field) => (
            <div
              key={field.id}
              style={{
                gridColumn: field.colSpan
                  ? `span ${Math.min(field.colSpan, schema.columns ?? 2)}`
                  : undefined,
              }}
            >
              {renderField({
                field,
                value: values[field.id],
                onChange: (value) => handleFieldChange(field.id, value),
                error: errorMessages[field.id],
                disabled: isLoading || readOnly,
              })}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!inline && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {footer}
          {!footer && (
            <>
              {schema.showCancel !== false && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading || isSubmitting}
                >
                  {schema.cancelLabel ?? "Annuler"}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || readOnly}
              >
                {(isLoading || isSubmitting) && (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="mr-2 h-4 w-4 "
                  />
                )}
                {schema.submitLabel ?? "Enregistrer"}
              </Button>
            </>
          )}
        </div>
      )}
    </form>
  );
}

// ============================================================================
// Schema Builder Helpers
// ============================================================================

export function createFormSchema(
  config: Partial<FormSchema> & { id: string },
): FormSchema {
  return {
    columns: 2,
    submitLabel: "Enregistrer",
    cancelLabel: "Annuler",
    showCancel: true,
    ...config,
  };
}

export function createField(
  config: Partial<FieldConfig> & { id: string; label: string },
): FieldConfig {
  return {
    type: "text",
    ...config,
  };
}

export function createSection(
  config: Partial<FormSection> & { id: string; fields: FieldConfig[] },
): FormSection {
  return {
    collapsible: false,
    defaultCollapsed: false,
    ...config,
  };
}

// ============================================================================
// Re-export types
// ============================================================================

export type {
  FormSchema,
  FormSection,
  FieldConfig,
  FieldType,
  SelectOption,
  ValidationRule,
  DynamicFormProps,
} from "@/lib/forms/types";
